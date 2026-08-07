import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { EnrolmentStatus, FeeType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { conflict, notFound, ruleViolation, validationError } from "@/lib/errors";
import { summariseAccount } from "@/lib/domain/balance";
import { checkTransition, matchStatuses } from "@/lib/domain/status-machine";
import { formatStudentId, intakeYearFromAcademicYear } from "@/lib/domain/student-id";
import { serialiseMoney } from "@/lib/money";
import { recordAudit } from "@/lib/services/audit";
import type { createStudentSchema, studentFilterSchema, updateStudentSchema } from "@/lib/validation/schemas";
import type { z } from "zod";

export const PAGE_SIZE = 10;

type CreateStudentInput = z.infer<typeof createStudentSchema>;
type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
type StudentFilter = z.infer<typeof studentFilterSchema>;

/**
 * Allocates the next registry reference for an intake year.
 *
 * A single atomic statement, not `count() + 1`: two administrators enrolling students at the same
 * moment would otherwise both read the same count and mint the same ID, and the loser gets a
 * unique-constraint crash mid-enrolment.
 */
export async function allocateStudentId(
  tx: Prisma.TransactionClient,
  intakeYear: number,
): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ lastSeq: number }>>`
    INSERT INTO "StudentIdCounter" ("year", "lastSeq")
    VALUES (${intakeYear}, 1)
    ON CONFLICT ("year") DO UPDATE SET "lastSeq" = "StudentIdCounter"."lastSeq" + 1
    RETURNING "lastSeq"
  `;
  return formatStudentId(intakeYear, rows[0].lastSeq);
}

export async function createStudent(input: CreateStudentInput, actorId: string) {
  const programme = await prisma.programme.findUnique({ where: { id: input.programmeId } });
  if (!programme) throw notFound("Programme");

  const existing = await prisma.student.findUnique({ where: { email: input.email } });
  if (existing) {
    throw conflict(`${input.email} is already registered to ${existing.studentId}`);
  }

  const intakeYear = intakeYearFromAcademicYear(input.academicYear);

  const student = await prisma.$transaction(async (tx) => {
    const studentId = await allocateStudentId(tx, intakeYear);

    const created = await tx.student.create({
      data: {
        studentId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        dateOfBirth: input.dateOfBirth,
        programmeId: input.programmeId,
        academicYear: input.academicYear,
        yearOfStudy: input.yearOfStudy,
        status: input.status,
      },
    });

    // Billing at enrolment is the common path — the fee is copied from the programme so a later
    // price change never rewrites what this cohort was charged.
    if (input.createFee && input.feeDueDate) {
      await tx.feeAssignment.create({
        data: {
          studentId: created.id,
          type: FeeType.TUITION,
          amount: programme.defaultFeeAmount,
          academicYear: input.academicYear,
          dueDate: input.feeDueDate,
          description: `Annual tuition fee — ${programme.name}`,
          createdById: actorId,
        },
      });
    }

    await recordAudit(tx, {
      actorId,
      action: "student.enrolled",
      entityType: "Student",
      entityId: created.id,
      metadata: { studentId, programme: programme.code, academicYear: input.academicYear },
    });

    return created;
  });

  return student;
}

export async function updateStudent(id: string, input: UpdateStudentInput, actorId: string) {
  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing) throw notFound("Student");

  if (input.email !== existing.email) {
    const clash = await prisma.student.findUnique({ where: { email: input.email } });
    if (clash) throw conflict(`${input.email} is already registered to ${clash.studentId}`);
  }

  const updated = await prisma.student.update({ where: { id }, data: input });
  await recordAudit(prisma, {
    actorId,
    action: "student.updated",
    entityType: "Student",
    entityId: id,
    metadata: { before: { email: existing.email, programmeId: existing.programmeId } },
  });
  return updated;
}

export async function changeStudentStatus(
  id: string,
  status: EnrolmentStatus,
  reason: string | undefined,
  actorId: string,
) {
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) throw notFound("Student");

  const check = checkTransition(student.status, status, reason);
  if (!check.ok) throw ruleViolation(check.reason);

  const updated = await prisma.student.update({
    where: { id },
    data: { status, statusReason: reason?.trim() || null, statusChangedAt: new Date() },
  });

  await recordAudit(prisma, {
    actorId,
    action: "student.status_changed",
    entityType: "Student",
    entityId: id,
    metadata: { from: student.status, to: status, reason: reason ?? null },
  });

  return updated;
}

/**
 * One query for the whole student register.
 *
 * Free text matches everything on the brief — name, registry ID, email, programme (code or
 * title) and enrolment status — ANDed with the dropdown filters. The dropdowns stay for precise
 * filtering; the box is for "I know roughly what I am after". Filters live in the URL so a view
 * can be shared.
 */
export function buildStudentWhere(filter: StudentFilter): Prisma.StudentWhereInput {
  const where: Prisma.StudentWhereInput = {};

  if (filter.q) {
    const q = filter.q;
    const or: Prisma.StudentWhereInput[] = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { studentId: { contains: q, mode: "insensitive" } },
      // Programme by code ("BSC-CS") or by title ("Computer Science").
      { programme: { code: { contains: q, mode: "insensitive" } } },
      { programme: { name: { contains: q, mode: "insensitive" } } },
    ];

    // "Amara Okafor" typed in full should still match a first/last name split.
    const parts = q.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      or.push({
        AND: [
          { firstName: { contains: parts[0], mode: "insensitive" } },
          { lastName: { contains: parts.slice(1).join(" "), mode: "insensitive" } },
        ],
      });
    }

    const statuses = matchStatuses(q);
    if (statuses.length > 0) or.push({ status: { in: statuses } });

    where.OR = or;
  }

  if (filter.programmeId) where.programmeId = filter.programmeId;
  if (filter.status) where.status = filter.status;

  return where;
}

const ORDER_BY: Record<StudentFilter["sort"], Prisma.StudentOrderByWithRelationInput[]> = {
  name: [{ lastName: "asc" }, { firstName: "asc" }],
  studentId: [{ studentId: "asc" }],
  recent: [{ createdAt: "desc" }],
};

export interface StudentRow {
  id: string;
  studentId: string;
  fullName: string;
  email: string;
  programme: { id: string; code: string; name: string; currency: string };
  academicYear: string;
  yearOfStudy: number;
  status: EnrolmentStatus;
  outstanding: string;
  overdueAmount: string;
  isOverdue: boolean;
  daysOverdue: number;
}

export async function listStudents(filter: StudentFilter) {
  const where = buildStudentWhere(filter);
  const now = new Date();

  const [rawTotal, records] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy: ORDER_BY[filter.sort],
      include: {
        programme: true,
        fees: { include: { payments: { select: { amount: true } } } },
      },
      // Arrears filters are applied after the balance is derived, so paginate afterwards.
      ...(filter.arrears ? {} : { skip: (filter.page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    }),
  ]);

  let rows: StudentRow[] = records.map((student) => {
    const account = summariseAccount(student.fees, now);
    return {
      id: student.id,
      studentId: student.studentId,
      fullName: `${student.firstName} ${student.lastName}`,
      email: student.email,
      programme: {
        id: student.programme.id,
        code: student.programme.code,
        name: student.programme.name,
        currency: student.programme.currency,
      },
      academicYear: student.academicYear,
      yearOfStudy: student.yearOfStudy,
      status: student.status,
      outstanding: serialiseMoney(account.outstanding),
      overdueAmount: serialiseMoney(account.overdueAmount),
      isOverdue: account.isOverdue,
      daysOverdue: account.maxDaysOverdue,
    };
  });

  let total = rawTotal;
  if (filter.arrears === "overdue") {
    rows = rows.filter((r) => r.isOverdue).sort((a, b) => b.daysOverdue - a.daysOverdue);
    total = rows.length;
    rows = rows.slice((filter.page - 1) * PAGE_SIZE, filter.page * PAGE_SIZE);
  } else if (filter.arrears === "outstanding") {
    rows = rows.filter((r) => Number(r.outstanding) > 0);
    total = rows.length;
    rows = rows.slice((filter.page - 1) * PAGE_SIZE, filter.page * PAGE_SIZE);
  }

  return {
    rows,
    total,
    page: filter.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getStudentDetail(id: string) {
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      programme: true,
      user: { select: { email: true } },
      fees: {
        include: { payments: { orderBy: { paidOn: "desc" } } },
        orderBy: { dueDate: "asc" },
      },
      submissions: {
        include: {
          assessment: { include: { module: true } },
          files: { orderBy: { version: "desc" } },
        },
        orderBy: { submittedAt: "desc" },
      },
      grades: {
        include: { assessment: { include: { module: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!student) throw notFound("Student");
  return student;
}

/** Looks a student up by either the cuid primary key or the human SMS-… reference. */
export async function findStudentByAnyId(value: string) {
  const student = await prisma.student.findFirst({
    where: { OR: [{ id: value }, { studentId: value.toUpperCase() }] },
  });
  if (!student) throw notFound("Student");
  return student;
}

export async function assertProgrammeExists(programmeId: string) {
  const programme = await prisma.programme.findUnique({ where: { id: programmeId } });
  if (!programme) throw validationError("Choose a valid programme", { programmeId: ["Unknown programme"] });
  return programme;
}
