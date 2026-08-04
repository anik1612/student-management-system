import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Download, Mail } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import {
  ClassificationBadge,
  FeeStateBadge,
  LateBadge,
  StatusBadge,
  WithheldBadge,
} from "@/components/badges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AppError } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatMoney, serialiseMoney } from "@/lib/money";
import { describeLateness } from "@/lib/domain/submission-rules";
import { allowedTransitions, STATUS_LABEL } from "@/lib/domain/status-machine";
import { getStudentAccount } from "@/lib/services/fees";
import { getStudentDetail } from "@/lib/services/students";
import { auditTrailFor } from "@/lib/services/audit";
import { ageOn } from "@/lib/validation/schemas";
import { StatusChanger } from "./status-changer";
import { AssignFeeDialog } from "./assign-fee-dialog";
import { RecordPaymentDialog } from "./record-payment-dialog";

export const dynamic = "force-dynamic";

export default async function StudentRecordPage(props: PageProps<"/staff/students/[id]">) {
  const { id } = await props.params;

  let student;
  try {
    student = await getStudentDetail(id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const [account, audit] = await Promise.all([
    getStudentAccount(student.id),
    auditTrailFor("Student", student.id, 8),
  ]);

  const fullName = `${student.firstName} ${student.lastName}`;
  const transitions = allowedTransitions(student.status);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/staff/students">
          <ArrowLeft className="size-4" /> Student register
        </Link>
      </Button>

      <PageHeader
        title={fullName}
        description={`${student.studentId} · ${student.programme.name} · ${student.academicYear}, year ${student.yearOfStudy}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={student.status} />
            <StatusChanger
              studentId={student.id}
              current={student.status}
              transitions={transitions}
            />
          </div>
        }
      />

      {account.summary.isOverdue ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="size-4" />
          <AlertTitle>Account in arrears</AlertTitle>
          <AlertDescription>
            {formatMoney(account.summary.overdueAmount)} is {account.summary.maxDaysOverdue} days past
            its due date. Results for this student are held back unless the arrears hold is
            explicitly overridden.
          </AlertDescription>
        </Alert>
      ) : null}

      {student.status === "WITHDRAWN" && Number(account.summary.outstanding) > 0 ? (
        <Alert className="mb-6">
          <AlertTriangle className="size-4" />
          <AlertTitle>Withdrawn with a balance owing</AlertTitle>
          <AlertDescription>
            {formatMoney(account.summary.outstanding)} remains outstanding. Withdrawn students stay
            on the arrears report but cannot be billed new fees.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* ---- Fees ---- */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fees and payments</CardTitle>
              <CardDescription>
                Balances are derived from the ledger every time this page loads.
              </CardDescription>
              <CardAction>
                <AssignFeeDialog
                  studentId={student.id}
                  academicYear={student.academicYear}
                  programme={{
                    code: student.programme.code,
                    defaultFeeAmount: serialiseMoney(student.programme.defaultFeeAmount),
                    currency: student.programme.currency,
                  }}
                  disabled={student.status === "WITHDRAWN" || student.status === "COMPLETED"}
                  disabledReason={`${STATUS_LABEL[student.status]} students cannot be billed new fees`}
                />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Billed" value={formatMoney(account.summary.billed)} />
                <Stat label="Paid" value={formatMoney(account.summary.paid)} />
                <Stat
                  label="Outstanding"
                  value={formatMoney(account.summary.outstanding)}
                  tone={account.summary.isOverdue ? "danger" : "default"}
                />
              </div>

              {account.lines.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No fees have been raised for this student yet.
                </p>
              ) : (
                account.lines.map((line) => (
                  <div key={line.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {line.description ?? line.type.replace("_", " ")}
                          </p>
                          <FeeStateBadge state={line.state} daysOverdue={line.daysOverdue} />
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {line.academicYear} · due {formatDate(line.dueDate)}
                        </p>
                        {line.overrideNote ? (
                          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                            Override: {line.overrideNote}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatMoney(line.outstanding, line.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatMoney(line.paid, line.currency)} of{" "}
                          {formatMoney(line.billed, line.currency)} paid
                        </p>
                      </div>
                    </div>

                    {line.payments.length > 0 ? (
                      <>
                        <Separator className="my-3" />
                        <ul className="space-y-1 text-sm">
                          {line.payments.map((p) => (
                            <li key={p.id} className="flex justify-between gap-3">
                              <span className="text-muted-foreground">
                                {formatDate(p.paidOn)} · {p.method.replace("_", " ").toLowerCase()} ·{" "}
                                <span className="font-mono text-xs">{p.reference}</span>
                              </span>
                              <span>{formatMoney(p.amount, line.currency)}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}

                    {Number(line.outstanding) > 0 ? (
                      <div className="mt-3">
                        <RecordPaymentDialog
                          feeId={line.id}
                          studentId={student.id}
                          outstanding={line.outstanding}
                          currency={line.currency}
                        />
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* ---- Submissions ---- */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Submissions</CardTitle>
              <CardDescription>
                Latest file per assessment. Superseded versions are retained.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {student.submissions.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">No work submitted yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assessment</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead className="text-right">File</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {student.submissions.map((submission) => (
                      <TableRow key={submission.id}>
                        <TableCell>
                          <Link
                            href={`/staff/assessments/${submission.assessmentId}`}
                            className="font-medium hover:underline"
                          >
                            {submission.assessment.title}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {submission.assessment.module.code}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{formatDateTime(submission.submittedAt)}</div>
                          {submission.isLate ? (
                            <LateBadge
                              label={describeLateness(
                                submission.submittedAt,
                                submission.assessment.dueAt,
                              )}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">On time</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          v{submission.version}
                          {submission.version > 1 ? (
                            <span className="block text-xs text-muted-foreground">
                              {submission.files.length} versions kept
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          {submission.files[0] ? (
                            <Button asChild variant="outline" size="sm">
                              <a href={`/api/files/${submission.files[0].id}`}>
                                <Download className="size-3.5" /> {submission.fileName.slice(0, 24)}
                              </a>
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* ---- Results ---- */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Results</CardTitle>
              <CardDescription>
                Students only see rows marked published on their own marksheet.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {student.grades.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">No marks entered yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assessment</TableHead>
                      <TableHead className="text-right">Mark</TableHead>
                      <TableHead>Classification</TableHead>
                      <TableHead>Visibility</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {student.grades.map((grade) => (
                      <TableRow key={grade.id}>
                        <TableCell>
                          <Link
                            href={`/staff/assessments/${grade.assessmentId}`}
                            className="font-medium hover:underline"
                          >
                            {grade.assessment.title}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {grade.assessment.module.code}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {grade.isAbsent ? (
                            <Badge variant="outline">Absent</Badge>
                          ) : (
                            `${grade.score}/100`
                          )}
                        </TableCell>
                        <TableCell>
                          <ClassificationBadge value={grade.classification} />
                        </TableCell>
                        <TableCell>
                          {grade.published ? (
                            <span className="text-sm text-emerald-700 dark:text-emerald-400">
                              Published {grade.publishedAt ? formatDate(grade.publishedAt) : ""}
                            </span>
                          ) : (
                            <div className="space-y-1">
                              <WithheldBadge reason={grade.withheldReason} />
                              {grade.withheldReason ? (
                                <p className="text-xs text-muted-foreground">
                                  {grade.withheldReason}
                                </p>
                              ) : null}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ---- Sidebar ---- */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Record</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Registry ID" value={<span className="font-mono">{student.studentId}</span>} />
              <Row
                label="Email"
                value={
                  <a href={`mailto:${student.email}`} className="inline-flex items-center gap-1 hover:underline">
                    <Mail className="size-3" />
                    {student.email}
                  </a>
                }
              />
              <Row
                label="Date of birth"
                value={`${formatDate(student.dateOfBirth)} (${ageOn(student.dateOfBirth, new Date())})`}
              />
              <Row label="Programme" value={`${student.programme.code} — ${student.programme.name}`} />
              <Row label="Session" value={`${student.academicYear}, year ${student.yearOfStudy}`} />
              <Row label="Enrolled on" value={formatDate(student.enrolledOn)} />
              <Row
                label="Status changed"
                value={`${formatDate(student.statusChangedAt)}`}
              />
              {student.statusReason ? (
                <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                  {student.statusReason}
                </div>
              ) : null}
              <Row label="Portal login" value={student.user ? "Active" : "None"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audit trail</CardTitle>
              <CardDescription>Who changed what, and when.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {audit.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
              ) : (
                audit.map((entry) => (
                  <div key={entry.id} className="border-b pb-2 text-sm last:border-0 last:pb-0">
                    <p className="font-medium">{entry.action.replace(/[._]/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.actor?.name ?? "System"} · {formatDateTime(entry.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          tone === "danger"
            ? "mt-1 text-lg font-semibold text-rose-700 dark:text-rose-400"
            : "mt-1 text-lg font-semibold"
        }
      >
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
