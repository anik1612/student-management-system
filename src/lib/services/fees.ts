import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { conflict, notFound, ruleViolation } from "@/lib/errors";
import { calculateFeeLine, summariseAccount, type FeeState } from "@/lib/domain/balance";
import { canBeBilled, STATUS_LABEL } from "@/lib/domain/status-machine";
import { formatMoney, serialiseMoney, toDecimal } from "@/lib/money";
import { recordAudit } from "@/lib/services/audit";
import type { assignFeeSchema, recordPaymentSchema } from "@/lib/validation/schemas";
import type { z } from "zod";

type AssignFeeInput = z.infer<typeof assignFeeSchema>;
type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export async function assignFee(input: AssignFeeInput, actorId: string) {
  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    include: { programme: true },
  });
  if (!student) throw notFound("Student");

  // A student who has left is not billed for anything new — but they keep the balance they already
  // owe, which is why this check is here and not in the arrears report.
  if (!canBeBilled(student.status)) {
    throw ruleViolation(
      `${STATUS_LABEL[student.status]} students cannot be billed new fees. Their existing balance stays on the arrears report.`,
    );
  }

  const duplicate = await prisma.feeAssignment.findUnique({
    where: {
      studentId_academicYear_type: {
        studentId: input.studentId,
        academicYear: input.academicYear,
        type: input.type,
      },
    },
  });
  if (duplicate) {
    throw conflict(
      `${student.studentId} already has a ${input.type.toLowerCase().replace("_", " ")} fee for ${input.academicYear}.`,
    );
  }

  const isOverride = !toDecimal(input.amount).equals(student.programme.defaultFeeAmount);

  const fee = await prisma.feeAssignment.create({
    data: {
      studentId: input.studentId,
      type: input.type,
      amount: input.amount,
      academicYear: input.academicYear,
      dueDate: input.dueDate,
      description: input.description ?? null,
      overrideNote: isOverride ? (input.overrideNote ?? "Amount differs from the programme default") : null,
      createdById: actorId,
    },
  });

  await recordAudit(prisma, {
    actorId,
    action: "fee.assigned",
    entityType: "Student",
    entityId: input.studentId,
    metadata: {
      feeId: fee.id,
      amount: serialiseMoney(fee.amount),
      programmeDefault: serialiseMoney(student.programme.defaultFeeAmount),
      override: isOverride,
      note: fee.overrideNote,
    },
  });

  return fee;
}

export async function recordPayment(input: RecordPaymentInput, actorId: string) {
  const fee = await prisma.feeAssignment.findUnique({
    where: { id: input.feeAssignmentId },
    include: { payments: true, student: true },
  });
  if (!fee) throw notFound("Fee");

  const amount = toDecimal(input.amount);
  if (amount.lessThanOrEqualTo(0)) throw ruleViolation("Payment amount must be greater than zero");

  const balance = calculateFeeLine(fee);
  // Overpayment is refused rather than silently creating a credit: Registry has a separate
  // refunds process, and a negative balance here would misreport the institution's income.
  if (amount.greaterThan(balance.outstanding)) {
    throw ruleViolation(
      `That is more than the ${formatMoney(balance.outstanding, fee.currency)} outstanding on this fee. Reduce the amount or raise a separate credit note.`,
    );
  }

  // Duplicate receipt references are the classic double-entry mistake: same bank reference keyed
  // twice clears a balance that was only paid once.
  const existingRef = await prisma.payment.findUnique({ where: { reference: input.reference } });
  if (existingRef) {
    throw conflict(`Reference ${input.reference} has already been recorded against another payment.`);
  }

  const payment = await prisma.payment.create({
    data: {
      feeAssignmentId: fee.id,
      amount: input.amount,
      paidOn: input.paidOn,
      reference: input.reference,
      method: input.method,
      note: input.note ?? null,
      recordedById: actorId,
    },
  });

  await recordAudit(prisma, {
    actorId,
    action: "payment.recorded",
    entityType: "Student",
    entityId: fee.studentId,
    metadata: {
      feeId: fee.id,
      amount: serialiseMoney(payment.amount),
      reference: payment.reference,
      method: payment.method,
    },
  });

  return payment;
}

export interface FeeLineView {
  id: string;
  type: string;
  description: string | null;
  academicYear: string;
  currency: string;
  dueDate: Date;
  billed: string;
  paid: string;
  outstanding: string;
  state: FeeState;
  daysOverdue: number;
  overrideNote: string | null;
  payments: Array<{
    id: string;
    amount: string;
    paidOn: Date;
    reference: string;
    method: string;
    note: string | null;
  }>;
}

type FeeWithPayments = Prisma.FeeAssignmentModel & {
  payments: Array<Prisma.PaymentModel>;
};

export function toFeeLineViews(fees: FeeWithPayments[], now = new Date()): FeeLineView[] {
  return fees.map((fee) => {
    const balance = calculateFeeLine(fee, now);
    return {
      id: fee.id,
      type: fee.type,
      description: fee.description,
      academicYear: fee.academicYear,
      currency: fee.currency,
      dueDate: fee.dueDate,
      billed: serialiseMoney(balance.billed),
      paid: serialiseMoney(balance.paid),
      outstanding: serialiseMoney(balance.outstanding),
      state: balance.state,
      daysOverdue: balance.daysOverdue,
      overrideNote: fee.overrideNote,
      payments: fee.payments.map((p) => ({
        id: p.id,
        amount: serialiseMoney(p.amount),
        paidOn: p.paidOn,
        reference: p.reference,
        method: p.method,
        note: p.note,
      })),
    };
  });
}

export async function getStudentAccount(studentId: string, now = new Date()) {
  const fees = await prisma.feeAssignment.findMany({
    where: { studentId },
    include: { payments: { orderBy: { paidOn: "desc" } } },
    orderBy: { dueDate: "asc" },
  });
  const summary = summariseAccount(fees, now);
  return {
    lines: toFeeLineViews(fees, now),
    summary: {
      billed: serialiseMoney(summary.billed),
      paid: serialiseMoney(summary.paid),
      outstanding: serialiseMoney(summary.outstanding),
      overdueAmount: serialiseMoney(summary.overdueAmount),
      isOverdue: summary.isOverdue,
      maxDaysOverdue: summary.maxDaysOverdue,
    },
  };
}

/** True when the student has any past-due unpaid fee — the arrears hold used before publishing results. */
export async function hasOverdueBalance(studentId: string, now = new Date()): Promise<boolean> {
  const fees = await prisma.feeAssignment.findMany({
    where: { studentId },
    include: { payments: { select: { amount: true } } },
  });
  return summariseAccount(fees, now).isOverdue;
}

export async function listFeeRegister(now = new Date()) {
  const students = await prisma.student.findMany({
    include: {
      programme: true,
      fees: { include: { payments: { select: { amount: true } } } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return students
    .map((student) => {
      const summary = summariseAccount(student.fees, now);
      return {
        id: student.id,
        studentId: student.studentId,
        fullName: `${student.firstName} ${student.lastName}`,
        status: student.status,
        programme: student.programme.code,
        currency: student.programme.currency,
        billed: serialiseMoney(summary.billed),
        paid: serialiseMoney(summary.paid),
        outstanding: serialiseMoney(summary.outstanding),
        overdueAmount: serialiseMoney(summary.overdueAmount),
        isOverdue: summary.isOverdue,
        daysOverdue: summary.maxDaysOverdue,
        feeCount: student.fees.length,
      };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue || Number(b.outstanding) - Number(a.outstanding));
}
