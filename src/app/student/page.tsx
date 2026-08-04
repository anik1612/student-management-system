import Link from "next/link";
import { AlertTriangle, CalendarClock, FileUp } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { StatusBadge } from "@/components/badges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStudent } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { getStudentAccount } from "@/lib/services/fees";
import { listAssessmentsForStudent } from "@/lib/services/assessments";
import { getPublishedMarksheet } from "@/lib/services/grades";

export const dynamic = "force-dynamic";
export const metadata = { title: "My record · SMS" };

export default async function StudentHomePage() {
  const session = await requireStudent();

  const [student, account, assessments, marksheet] = await Promise.all([
    prisma.student.findUniqueOrThrow({
      where: { id: session.studentId },
      include: { programme: true },
    }),
    getStudentAccount(session.studentId),
    listAssessmentsForStudent(session.studentId),
    getPublishedMarksheet(session.studentId),
  ]);

  const open = assessments.filter((a) => a.isOpen);
  const awaitingSubmission = open.filter((a) => !a.submission);

  return (
    <>
      <PageHeader
        title={`Hello, ${student.firstName}`}
        description={`${student.studentId} · ${student.programme.name} · ${student.academicYear}, year ${student.yearOfStudy}`}
        action={<StatusBadge status={student.status} />}
      />

      {account.summary.isOverdue ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="size-4" />
          <AlertTitle>Your account is overdue</AlertTitle>
          <AlertDescription>
            {formatMoney(account.summary.overdueAmount)} was due{" "}
            {account.summary.maxDaysOverdue} days ago. Results may be withheld until the balance is
            settled — please contact Registry.
          </AlertDescription>
        </Alert>
      ) : null}

      {student.status === "WITHDRAWN" || student.status === "COMPLETED" ? (
        <Alert className="mb-6">
          <AlertTitle>Your enrolment is {student.status.toLowerCase()}</AlertTitle>
          <AlertDescription>
            {student.statusReason ?? "Contact Registry if you believe this is incorrect."}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Outstanding balance</p>
            <p
              className={
                account.summary.isOverdue
                  ? "mt-1 text-2xl font-semibold text-rose-700 dark:text-rose-400"
                  : "mt-1 text-2xl font-semibold"
              }
            >
              {formatMoney(account.summary.outstanding)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatMoney(account.summary.paid)} paid of {formatMoney(account.summary.billed)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Open assessments</p>
            <p className="mt-1 text-2xl font-semibold">{open.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {awaitingSubmission.length} still to submit
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Published results</p>
            <p className="mt-1 text-2xl font-semibold">{marksheet.grades.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {marksheet.pendingCount > 0
                ? `${marksheet.pendingCount} result${marksheet.pendingCount === 1 ? "" : "s"} pending release`
                : "Nothing pending"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4" /> Upcoming deadlines
            </CardTitle>
            <CardDescription>Assessments still open on your programme.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {open.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nothing is open for submission right now.
              </p>
            ) : (
              open.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.module.code} · due {formatDateTime(a.dueAt)}
                    </p>
                  </div>
                  {a.submission ? (
                    <span className="text-xs text-emerald-700 dark:text-emerald-400">Submitted</span>
                  ) : (
                    <Button asChild size="sm" variant="outline">
                      <Link href="/student/assessments">
                        <FileUp className="size-3.5" /> Submit
                      </Link>
                    </Button>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fee summary</CardTitle>
            <CardDescription>Full statement on the Fees page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {account.lines.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No fees have been raised yet.
              </p>
            ) : (
              account.lines.map((line) => (
                <div
                  key={line.id}
                  className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium">{line.description ?? line.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {line.academicYear} · due {formatDate(line.dueDate)}
                    </p>
                  </div>
                  <p className="text-sm font-medium">
                    {formatMoney(line.outstanding, line.currency)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
