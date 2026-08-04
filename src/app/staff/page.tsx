import Link from "next/link";
import {
  AlertTriangle,
  BanknoteArrowUp,
  CalendarClock,
  Clock,
  EyeOff,
  PenLine,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { StatusBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import { getDashboard } from "@/lib/services/dashboard";
import { describeLateness } from "@/lib/domain/submission-rules";
import { formatDate, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Registry dashboard · SMS" };

export default async function StaffDashboardPage() {
  const data = await getDashboard();

  return (
    <>
      <PageHeader
        title="Registry dashboard"
        description="What needs attention today across enrolment, fees, submissions and results."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users className="size-4" />}
          label="Students"
          value={String(data.students.total)}
          hint={`${data.students.byStatus.ENROLLED} enrolled · ${data.students.byStatus.DEFERRED} deferred · ${data.students.byStatus.WITHDRAWN} withdrawn · ${data.students.byStatus.COMPLETED} completed`}
        />
        <StatCard
          icon={<BanknoteArrowUp className="size-4" />}
          label="Fees collected"
          value={formatMoney(data.money.paid)}
          hint={`${data.money.collectionRate}% of ${formatMoney(data.money.billed)} billed`}
        />
        <StatCard
          icon={<AlertTriangle className="size-4" />}
          label="Overdue"
          value={formatMoney(data.money.overdue)}
          hint={`${data.workload.studentsInArrears} student${data.workload.studentsInArrears === 1 ? "" : "s"} in arrears`}
          tone={Number(data.money.overdue) > 0 ? "danger" : "default"}
        />
        <StatCard
          icon={<EyeOff className="size-4" />}
          label="Results unpublished"
          value={String(data.workload.unpublishedResults)}
          hint={`${data.workload.ungradedSubmissions} submission${data.workload.ungradedSubmissions === 1 ? "" : "s"} still to mark`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="size-4 text-rose-600" />
                Fee arrears
              </CardTitle>
              <CardDescription>
                Past the due date with money still outstanding — oldest first.
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/staff/fees">Fee register</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.arrears.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No overdue accounts. Everything billed so far is either paid or not yet due.
              </p>
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
                        <Link href={`/staff/students/${row.id}`} className="font-medium hover:underline">
                          {row.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {row.studentId} · {row.programme}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-right font-medium text-rose-700 dark:text-rose-400">
                        {formatMoney(row.overdueAmount, row.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="border-rose-600/30 bg-rose-500/10 text-rose-700 dark:text-rose-300">
                          {row.daysOverdue}d
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4" />
              Upcoming deadlines
            </CardTitle>
            <CardDescription>Assessments still open for submission.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.upcoming.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No open assessments.</p>
            ) : (
              data.upcoming.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <Link href={`/staff/assessments/${a.id}`} className="text-sm font-medium hover:underline">
                      {a.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {a.module} · {a.submissions} in
                    </p>
                  </div>
                  <span className="text-xs whitespace-nowrap text-muted-foreground">
                    {formatDate(a.dueAt)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4 text-amber-600" />
              Late submissions
            </CardTitle>
            <CardDescription>
              Accepted, but flagged — lateness is frozen at the moment of submission.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.lateSubmissions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nothing has come in late.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Assessment</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Late by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lateSubmissions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link href={`/staff/students/${s.studentKey}`} className="font-medium hover:underline">
                          {s.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">{s.studentId}</div>
                      </TableCell>
                      <TableCell>
                        <Link href={`/staff/assessments/${s.assessmentId}`} className="hover:underline">
                          {s.assessment}
                        </Link>
                        <div className="text-xs text-muted-foreground">{s.module}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(s.dueAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(s.submittedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className="border-amber-600/30 bg-amber-500/15 text-amber-800 dark:text-amber-300"
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
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/staff/students/new">
            <Users className="size-4" /> Enrol a student
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/staff/assessments/new">
            <PenLine className="size-4" /> Create an assessment
          </Link>
        </Button>
      </div>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "danger";
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon}
          {label}
        </div>
        <p
          className={
            tone === "danger"
              ? "mt-2 text-2xl font-semibold tracking-tight text-rose-700 dark:text-rose-400"
              : "mt-2 text-2xl font-semibold tracking-tight"
          }
        >
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
