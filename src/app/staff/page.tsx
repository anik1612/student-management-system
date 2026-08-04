import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Clock,
  EyeOff,
  PenLine,
  UserPlus,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { StatTile } from "@/components/stat-tile";
import { HorizontalBars, StackedShareBar, Sparkline } from "@/components/charts";
import { StatusBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EnrolmentStatus } from "@/generated/prisma/enums";
import { STATUS_LABEL } from "@/lib/domain/status-machine";
import { describeLateness } from "@/lib/domain/submission-rules";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { getDashboard } from "@/lib/services/dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Registry dashboard · SMS" };

export default async function StaffDashboardPage() {
  const data = await getDashboard();

  const outstanding = Number(data.money.outstanding);
  const overdue = Number(data.money.overdue);
  const billed = Number(data.money.billed);
  const paid = Number(data.money.paid);
  // Outstanding that is not yet past its due date — the part nobody needs to chase.
  const onSchedule = Math.max(0, outstanding - overdue);

  const actionsWaiting =
    data.workload.ungradedSubmissions +
    data.workload.unpublishedResults +
    data.workload.studentsInArrears;

  return (
    <>
      <PageHeader
        title="Registry dashboard"
        description="Fee position, arrears to chase, work waiting to be marked and results still to release."
        action={
          <>
            <Button asChild variant="outline">
              <Link href="/staff/assessments/new">
                <PenLine className="size-4" /> New assessment
              </Link>
            </Button>
            <Button asChild>
              <Link href="/staff/students/new">
                <UserPlus className="size-4" /> Enrol a student
              </Link>
            </Button>
          </>
        }
      />

      {/* Hero band — the one number the view leads with, plus its trend. */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Outstanding across all accounts</p>
                <p className="mt-1 text-5xl leading-none font-semibold tracking-tight">
                  {formatMoney(outstanding)}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {formatMoney(paid)} collected of {formatMoney(billed)} billed ·{" "}
                  <span className="font-medium text-foreground">
                    {data.money.collectionRate}% collection rate
                  </span>
                </p>
              </div>

              {data.collections.some((c) => c.value > 0) ? (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Collected, last 6 months</p>
                  <div className="mt-2 flex justify-end">
                    <Sparkline points={data.collections.map((c) => c.value)} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {data.collections[0].label} – {data.collections[data.collections.length - 1].label}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-6">
              <StackedShareBar
                segments={[
                  {
                    key: "paid",
                    label: "Collected",
                    value: paid,
                    tone: "good",
                    display: formatMoney(paid),
                  },
                  {
                    key: "on-schedule",
                    label: "Outstanding, not yet due",
                    value: onSchedule,
                    tone: "neutral",
                    display: formatMoney(onSchedule),
                  },
                  {
                    key: "overdue",
                    label: "Overdue",
                    value: overdue,
                    tone: "critical",
                    display: formatMoney(overdue),
                  },
                ]}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Arrears by age</CardTitle>
            <CardDescription>How old the overdue debt is.</CardDescription>
          </CardHeader>
          <CardContent>
            <HorizontalBars
              labelWidth="5.25rem"
              valueWidth="5.5rem"
              emptyMessage="No overdue accounts."
              data={data.ageing.map((band, i) => ({
                key: band.key,
                label: band.label,
                value: Number(band.amount),
                display: formatMoney(band.amount),
                // Ordered bands → ordinal ramp, oldest darkest.
                fill: `var(--chart-${[3, 2, 1, 4][i]})`,
              }))}
            />
            <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
              {data.workload.studentsInArrears} student
              {data.workload.studentsInArrears === 1 ? "" : "s"} in arrears
            </p>
          </CardContent>
        </Card>
      </div>

      {/* KPI row */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Students on register"
          value={String(data.students.total)}
          icon="students"
          href="/staff/students"
          hint={`${data.students.byStatus.ENROLLED} enrolled · ${data.students.byStatus.DEFERRED} deferred · ${data.students.byStatus.WITHDRAWN} withdrawn · ${data.students.byStatus.COMPLETED} completed`}
        />
        <StatTile
          label="Overdue"
          value={formatMoney(overdue)}
          icon="fees"
          tone={overdue > 0 ? "critical" : "good"}
          href="/staff/students?arrears=overdue"
          hint={
            data.arrears.length > 0
              ? `Oldest ${data.arrears[0].daysOverdue} days · ${data.arrears[0].name}`
              : "Nothing past its due date"
          }
        />
        <StatTile
          label="Submissions to mark"
          value={String(data.workload.ungradedSubmissions)}
          icon="submissions"
          href="/staff/assessments"
          hint={`${data.lateSubmissions.length} came in late`}
        />
        <StatTile
          label="Results awaiting release"
          value={String(data.workload.unpublishedResults)}
          icon="results"
          href="/staff/assessments"
          hint="Students cannot see a mark until it is published"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Arrears — the chase list */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-(--chart-critical)" />
              Fee arrears
            </CardTitle>
            <CardDescription>Past the due date with money outstanding, oldest first.</CardDescription>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link href="/staff/fees">
                  Fee register <ArrowUpRight className="size-3.5" />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="p-0">
            {data.arrears.length === 0 ? (
              <EmptyState message="No overdue accounts. Everything billed is either paid or not yet due." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Overdue</TableHead>
                    <TableHead className="text-right">Age</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.arrears.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar name={row.name} />
                          <div className="min-w-0">
                            <Link
                              href={`/staff/students/${row.id}`}
                              className="font-medium hover:underline"
                            >
                              {row.name}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {row.studentId} · {row.programme}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-(--chart-critical)">
                        {formatMoney(row.overdueAmount, row.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-medium tabular-nums">{row.daysOverdue}d</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Cohort composition */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Register by status</CardTitle>
            <CardDescription>Where the {data.students.total} records sit.</CardDescription>
          </CardHeader>
          <CardContent>
            <HorizontalBars
              labelWidth="5.5rem"
              emptyMessage="No students enrolled yet."
              data={Object.values(EnrolmentStatus).map((status) => ({
                key: status,
                label: STATUS_LABEL[status],
                value: data.students.byStatus[status],
                // One series, one colour — the labels carry identity, not the hue.
                href: `/staff/students?status=${status}`,
              }))}
            />
          </CardContent>
        </Card>

        {/* Late work */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4 text-(--chart-warning)" />
              Late submissions
            </CardTitle>
            <CardDescription>
              Accepted, but flagged — lateness is frozen at the moment of submission.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.lateSubmissions.length === 0 ? (
              <EmptyState message="Nothing has come in late." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Assessment</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Late by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lateSubmissions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar name={s.name} />
                          <div className="min-w-0">
                            <Link
                              href={`/staff/students/${s.studentKey}`}
                              className="font-medium hover:underline"
                            >
                              {s.name}
                            </Link>
                            <p className="text-xs text-muted-foreground">{s.studentId}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/staff/assessments/${s.assessmentId}`}
                          className="text-sm hover:underline"
                        >
                          {s.assessment}
                        </Link>
                        <p className="text-xs text-muted-foreground">{s.module}</p>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                        {formatDateTime(s.submittedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className="border-[color-mix(in_oklab,var(--chart-warning)_45%,transparent)] bg-[color-mix(in_oklab,var(--chart-warning)_14%,transparent)] whitespace-nowrap text-amber-800 dark:text-amber-300"
                        >
                          {describeLateness(s.submittedAt, s.dueAt)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Deadlines */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4" />
              Upcoming deadlines
            </CardTitle>
            <CardDescription>Assessments still open for submission.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.upcoming.length === 0 ? (
              <EmptyState message="No open assessments." />
            ) : (
              data.upcoming.map((a) => (
                <Link
                  key={a.id}
                  href={`/staff/assessments/${a.id}`}
                  className="flex items-start justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {a.module} · {a.submissions} submitted
                    </p>
                  </div>
                  <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
                    {formatDate(a.dueAt)}
                  </span>
                </Link>
              ))
            )}
            {actionsWaiting === 0 ? null : (
              <p className="flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
                <EyeOff className="size-3.5" />
                {actionsWaiting} item{actionsWaiting === 1 ? "" : "s"} waiting on Registry
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
      {initials}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="px-6 py-10 text-center text-sm text-muted-foreground">{message}</p>;
}
