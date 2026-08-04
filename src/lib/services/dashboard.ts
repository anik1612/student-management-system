import "server-only";
import { EnrolmentStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { summariseAccount } from "@/lib/domain/balance";
import { serialiseMoney } from "@/lib/money";

/**
 * The Registry dashboard answers "what needs me today?" — arrears to chase, late work to look at,
 * marks sitting unentered, and results that have been marked but not yet released.
 */
export async function getDashboard(now = new Date()) {
  const [students, statusCounts, lateSubmissions, ungraded, unpublished, upcoming] = await Promise.all([
    prisma.student.findMany({
      include: {
        programme: { select: { code: true, currency: true } },
        fees: { include: { payments: { select: { amount: true } } } },
      },
    }),
    prisma.student.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.submission.findMany({
      where: { isLate: true },
      include: {
        student: { select: { id: true, studentId: true, firstName: true, lastName: true } },
        assessment: { select: { id: true, title: true, dueAt: true, module: { select: { code: true } } } },
      },
      orderBy: { submittedAt: "desc" },
      take: 8,
    }),
    prisma.submission.count({ where: { assessment: { grades: { none: {} } } } }),
    prisma.grade.count({ where: { published: false } }),
    prisma.assessment.findMany({
      where: { dueAt: { gte: now } },
      include: {
        module: { select: { code: true, title: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { dueAt: "asc" },
      take: 5,
    }),
  ]);

  const accounts = students.map((student) => ({
    student,
    account: summariseAccount(student.fees, now),
  }));

  const arrears = accounts
    .filter((a) => a.account.isOverdue)
    .sort((a, b) => b.account.maxDaysOverdue - a.account.maxDaysOverdue)
    .map((a) => ({
      id: a.student.id,
      studentId: a.student.studentId,
      name: `${a.student.firstName} ${a.student.lastName}`,
      programme: a.student.programme.code,
      status: a.student.status,
      currency: a.student.programme.currency,
      overdueAmount: serialiseMoney(a.account.overdueAmount),
      outstanding: serialiseMoney(a.account.outstanding),
      daysOverdue: a.account.maxDaysOverdue,
    }));

  const totals = accounts.reduce(
    (acc, a) => ({
      billed: acc.billed.plus(a.account.billed),
      paid: acc.paid.plus(a.account.paid),
      outstanding: acc.outstanding.plus(a.account.outstanding),
      overdue: acc.overdue.plus(a.account.overdueAmount),
    }),
    {
      billed: summariseAccount([]).billed,
      paid: summariseAccount([]).paid,
      outstanding: summariseAccount([]).outstanding,
      overdue: summariseAccount([]).overdueAmount,
    },
  );

  const byStatus = Object.fromEntries(
    Object.values(EnrolmentStatus).map((status) => [
      status,
      statusCounts.find((s) => s.status === status)?._count._all ?? 0,
    ]),
  ) as Record<EnrolmentStatus, number>;

  const collectionRate = Number(totals.billed) > 0
    ? Math.round((Number(totals.paid) / Number(totals.billed)) * 100)
    : 100;

  return {
    students: {
      total: students.length,
      byStatus,
    },
    money: {
      billed: serialiseMoney(totals.billed),
      paid: serialiseMoney(totals.paid),
      outstanding: serialiseMoney(totals.outstanding),
      overdue: serialiseMoney(totals.overdue),
      collectionRate,
    },
    arrears,
    lateSubmissions: lateSubmissions.map((s) => ({
      id: s.id,
      studentId: s.student.studentId,
      studentKey: s.student.id,
      name: `${s.student.firstName} ${s.student.lastName}`,
      assessmentId: s.assessment.id,
      assessment: s.assessment.title,
      module: s.assessment.module.code,
      dueAt: s.assessment.dueAt,
      submittedAt: s.submittedAt,
    })),
    workload: {
      ungradedSubmissions: ungraded,
      unpublishedResults: unpublished,
      studentsInArrears: arrears.length,
    },
    upcoming: upcoming.map((a) => ({
      id: a.id,
      title: a.title,
      module: a.module.code,
      dueAt: a.dueAt,
      submissions: a._count.submissions,
    })),
  };
}
