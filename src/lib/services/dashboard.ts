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

  // Arrears ageing. Ordered bands, so the dashboard can show how *old* the debt is, not just
  // how much — a registrar chases 90-day debt differently from last week's.
  const AGE_BANDS = [
    { key: "1-30", label: "1–30 days", min: 1, max: 30 },
    { key: "31-60", label: "31–60 days", min: 31, max: 60 },
    { key: "61-90", label: "61–90 days", min: 61, max: 90 },
    { key: "90+", label: "Over 90 days", min: 91, max: Number.POSITIVE_INFINITY },
  ];

  const ageing = AGE_BANDS.map((band) => {
    const matching = arrears.filter(
      (a) => a.daysOverdue >= band.min && a.daysOverdue <= band.max,
    );
    return {
      key: band.key,
      label: band.label,
      students: matching.length,
      amount: serialiseMoney(
        matching.reduce((sum, a) => sum + Number(a.overdueAmount), 0).toFixed(2),
      ),
    };
  });

  // Cash collected per month over the last six months — the trend behind the headline.
  const payments = await prisma.payment.findMany({
    select: { amount: true, paidOn: true },
    orderBy: { paidOn: "asc" },
  });

  const collections: Array<{ key: string; label: string; amount: string; value: number }> = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
    const inMonth = payments.filter((p) => p.paidOn >= start && p.paidOn < end);
    const value = inMonth.reduce((sum, p) => sum + Number(p.amount), 0);
    collections.push({
      key: start.toISOString().slice(0, 7),
      label: start.toLocaleDateString("en-GB", { month: "short" }),
      amount: serialiseMoney(value.toFixed(2)),
      value,
    });
  }

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
    ageing,
    collections,
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
