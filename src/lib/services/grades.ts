import "server-only";
import { prisma } from "@/lib/db";
import { notFound, ruleViolation } from "@/lib/errors";
import { classifyResult } from "@/lib/domain/classification";
import { formatMoney } from "@/lib/money";
import { getStudentAccount, hasOverdueBalance } from "@/lib/services/fees";
import { recordAudit } from "@/lib/services/audit";
import type { enterGradeSchema } from "@/lib/validation/schemas";
import type { z } from "zod";

type EnterGradeInput = z.infer<typeof enterGradeSchema>;

export async function enterGrade(input: EnterGradeInput, actorId: string) {
  const [assessment, student] = await Promise.all([
    prisma.assessment.findUnique({ where: { id: input.assessmentId }, include: { module: true } }),
    prisma.student.findUnique({ where: { id: input.studentId } }),
  ]);
  if (!assessment) throw notFound("Assessment");
  if (!student) throw notFound("Student");
  if (student.programmeId !== assessment.module.programmeId) {
    throw ruleViolation("That student is not enrolled on this assessment's programme");
  }

  const score = input.isAbsent ? null : input.score;
  const classification = classifyResult({ score, isAbsent: input.isAbsent });

  const existing = await prisma.grade.findUnique({
    where: { assessmentId_studentId: { assessmentId: assessment.id, studentId: student.id } },
  });

  const grade = await prisma.grade.upsert({
    where: { assessmentId_studentId: { assessmentId: assessment.id, studentId: student.id } },
    create: {
      assessmentId: assessment.id,
      studentId: student.id,
      score,
      isAbsent: input.isAbsent,
      classification,
      feedback: input.feedback ?? null,
      enteredById: actorId,
    },
    update: {
      score,
      isAbsent: input.isAbsent,
      classification,
      feedback: input.feedback ?? null,
      enteredById: actorId,
      // Amending a mark pulls it back off the student's marksheet until it is re-released —
      // a published result should never change under the student's feet.
      published: false,
      publishedAt: null,
      withheldReason: existing?.published ? "Mark amended — awaiting re-publication" : existing?.withheldReason ?? null,
    },
  });

  await recordAudit(prisma, {
    actorId,
    action: existing ? "grade.amended" : "grade.entered",
    entityType: "Grade",
    entityId: grade.id,
    metadata: {
      studentId: student.id,
      assessmentId: assessment.id,
      from: existing ? { score: existing.score, isAbsent: existing.isAbsent } : null,
      to: { score, isAbsent: input.isAbsent, classification },
      unpublished: Boolean(existing?.published),
    },
  });

  return grade;
}

export interface PublishOutcome {
  published: number;
  heldBack: Array<{ studentId: string; name: string; reason: string }>;
}

/**
 * Releases a single result.
 *
 * Registry practice: results are held back where the student is in fee arrears. That is enforced
 * here rather than left to the operator's memory, but staff can knowingly override it (recorded in
 * the audit log) because there are legitimate exceptions — hardship cases, disputed invoices.
 */
export async function setGradePublished(
  gradeId: string,
  publish: boolean,
  options: { withheldReason?: string; overrideArrearsHold?: boolean },
  actorId: string,
): Promise<{ grade: Awaited<ReturnType<typeof prisma.grade.update>>; warning?: string }> {
  const grade = await prisma.grade.findUnique({
    where: { id: gradeId },
    include: { student: true, assessment: true },
  });
  if (!grade) throw notFound("Grade");

  if (publish && grade.score === null && !grade.isAbsent) {
    throw ruleViolation("Enter a mark before publishing this result");
  }

  let warning: string | undefined;

  if (publish) {
    const account = await getStudentAccount(grade.studentId);
    if (account.summary.isOverdue && !options.overrideArrearsHold) {
      throw ruleViolation(
        `${grade.student.firstName} ${grade.student.lastName} has ${formatMoney(account.summary.overdueAmount)} overdue. Settle the account, or publish again with the arrears hold overridden.`,
      );
    }
    if (account.summary.isOverdue) {
      warning = `Published despite ${formatMoney(account.summary.overdueAmount)} overdue — the override is recorded in the audit log.`;
    }
  }

  const updated = await prisma.grade.update({
    where: { id: gradeId },
    data: {
      published: publish,
      publishedAt: publish ? new Date() : null,
      withheldReason: publish ? null : (options.withheldReason?.trim() || "Withheld by Registry"),
    },
  });

  await recordAudit(prisma, {
    actorId,
    action: publish ? "grade.published" : "grade.withheld",
    entityType: "Grade",
    entityId: gradeId,
    metadata: {
      studentId: grade.studentId,
      assessmentId: grade.assessmentId,
      arrearsOverride: Boolean(publish && options.overrideArrearsHold),
      reason: publish ? null : options.withheldReason ?? null,
    },
  });

  return { grade: updated, warning };
}

/** Bulk release for a whole assessment, skipping (and reporting) anyone on an arrears hold. */
export async function publishAssessmentResults(
  assessmentId: string,
  overrideArrearsHold: boolean,
  actorId: string,
): Promise<PublishOutcome> {
  const grades = await prisma.grade.findMany({
    where: { assessmentId, published: false },
    include: { student: true },
  });

  const outcome: PublishOutcome = { published: 0, heldBack: [] };

  for (const grade of grades) {
    if (grade.score === null && !grade.isAbsent) {
      outcome.heldBack.push({
        studentId: grade.student.studentId,
        name: `${grade.student.firstName} ${grade.student.lastName}`,
        reason: "No mark entered yet",
      });
      continue;
    }

    const overdue = await hasOverdueBalance(grade.studentId);
    if (overdue && !overrideArrearsHold) {
      await prisma.grade.update({
        where: { id: grade.id },
        data: { withheldReason: "Withheld pending fee settlement" },
      });
      outcome.heldBack.push({
        studentId: grade.student.studentId,
        name: `${grade.student.firstName} ${grade.student.lastName}`,
        reason: "Fee arrears",
      });
      continue;
    }

    await prisma.grade.update({
      where: { id: grade.id },
      data: { published: true, publishedAt: new Date(), withheldReason: null },
    });
    outcome.published += 1;
  }

  await recordAudit(prisma, {
    actorId,
    action: "grade.bulk_published",
    entityType: "Assessment",
    entityId: assessmentId,
    metadata: {
      published: outcome.published,
      heldBack: outcome.heldBack.length,
      arrearsOverride: overrideArrearsHold,
    },
  });

  return outcome;
}

/**
 * The student-facing marksheet. Unpublished marks never leave the server: the score is not simply
 * hidden in the UI, it is not selected at all.
 */
export async function getPublishedMarksheet(studentId: string) {
  const grades = await prisma.grade.findMany({
    where: { studentId, published: true },
    select: {
      id: true,
      score: true,
      isAbsent: true,
      classification: true,
      feedback: true,
      publishedAt: true,
      assessment: {
        select: { id: true, title: true, dueAt: true, weighting: true, module: { select: { code: true, title: true } } },
      },
    },
    orderBy: { publishedAt: "desc" },
  });

  const pendingCount = await prisma.grade.count({ where: { studentId, published: false } });
  const awaitingMark = await prisma.submission.count({
    where: { studentId, assessment: { grades: { none: { studentId } } } },
  });

  return { grades, pendingCount, awaitingMark };
}
