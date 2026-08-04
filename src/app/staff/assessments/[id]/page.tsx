import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Download } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { describeLateness } from "@/lib/domain/submission-rules";
import { summariseAccount } from "@/lib/domain/balance";
import { serialiseMoney } from "@/lib/money";
import { getAssessmentDetail } from "@/lib/services/assessments";
import { Marksheet, type MarksheetRow } from "./marksheet";
import { PublishAllButton } from "./publish-all";

export const dynamic = "force-dynamic";

export default async function AssessmentPage(props: PageProps<"/staff/assessments/[id]">) {
  const { id } = await props.params;

  let assessment;
  try {
    assessment = await getAssessmentDetail(id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  // The marksheet covers the whole enrolled cohort, not only those who submitted — a missing
  // submission is a fact staff need to record (absent), not a row that quietly disappears.
  const cohort = await prisma.student.findMany({
    where: { programmeId: assessment.module.programmeId, status: { in: ["ENROLLED", "DEFERRED"] } },
    include: { fees: { include: { payments: { select: { amount: true } } } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const submissionByStudent = new Map(assessment.submissions.map((s) => [s.studentId, s]));
  const gradeByStudent = new Map(assessment.grades.map((g) => [g.studentId, g]));

  const rows: MarksheetRow[] = cohort.map((student) => {
    const submission = submissionByStudent.get(student.id);
    const grade = gradeByStudent.get(student.id);
    const account = summariseAccount(student.fees);

    return {
      studentKey: student.id,
      studentId: student.studentId,
      name: `${student.firstName} ${student.lastName}`,
      submission: submission
        ? {
            id: submission.id,
            fileId: submission.files[0]?.id ?? null,
            fileName: submission.fileName,
            submittedAt: submission.submittedAt.toISOString(),
            isLate: submission.isLate,
            lateness: describeLateness(submission.submittedAt, assessment.dueAt),
            version: submission.version,
          }
        : null,
      grade: grade
        ? {
            id: grade.id,
            score: grade.score,
            isAbsent: grade.isAbsent,
            classification: grade.classification,
            feedback: grade.feedback,
            published: grade.published,
            withheldReason: grade.withheldReason,
          }
        : null,
      inArrears: account.isOverdue,
      overdueAmount: serialiseMoney(account.overdueAmount),
    };
  });

  const isOpen = assessment.dueAt.getTime() > Date.now();
  const marked = rows.filter((r) => r.grade).length;
  const published = rows.filter((r) => r.grade?.published).length;
  const arrearsHolds = rows.filter((r) => r.grade && !r.grade.published && r.inArrears).length;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/staff/assessments">
          <ArrowLeft className="size-4" /> Assessments
        </Link>
      </Button>

      <PageHeader
        title={assessment.title}
        description={`${assessment.module.code} — ${assessment.module.title} · ${assessment.module.programme.name} · ${assessment.weighting}% of the module`}
        action={
          <PublishAllButton
            assessmentId={assessment.id}
            unpublished={marked - published}
            arrearsHolds={arrearsHolds}
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Deadline</p>
            <p className="mt-1 font-medium">{formatDateTime(assessment.dueAt)}</p>
            <Badge
              variant="outline"
              className={
                isOpen
                  ? "mt-2 border-emerald-600/25 bg-emerald-500/12 text-emerald-800 dark:text-emerald-300"
                  : "mt-2 text-muted-foreground"
              }
            >
              {isOpen ? "Open for submission" : "Closed"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Submitted</p>
            <p className="mt-1 text-2xl font-semibold">
              {assessment.submissions.length}
              <span className="text-base font-normal text-muted-foreground"> / {rows.length}</span>
            </p>
            {assessment.submissions.some((s) => s.isLate) ? (
              <Badge
                variant="outline"
                className="mt-1 border-amber-600/30 bg-amber-500/15 text-amber-800 dark:text-amber-300"
              >
                <Clock className="size-3" />
                {assessment.submissions.filter((s) => s.isLate).length} late
              </Badge>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Marked</p>
            <p className="mt-1 text-2xl font-semibold">{marked}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Published</p>
            <p className="mt-1 text-2xl font-semibold">{published}</p>
            {arrearsHolds > 0 ? (
              <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">
                {arrearsHolds} held for arrears
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {assessment.description ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Brief</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{assessment.description}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Marksheet</CardTitle>
          <CardDescription>
            Pass ≥ 40, Merit ≥ 60, Distinction ≥ 70. Enter a mark or record the student absent;
            amending a published mark pulls it back until it is released again.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Marksheet assessmentId={assessment.id} rows={rows} />
        </CardContent>
      </Card>

      {assessment.submissions.length > 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Submitted files</CardTitle>
            <CardDescription>
              Every version is retained, including drafts replaced before the deadline.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {assessment.submissions.map((submission) => (
              <div key={submission.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link
                      href={`/staff/students/${submission.studentId}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {submission.student.firstName} {submission.student.lastName}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {submission.student.studentId}
                    </span>
                  </div>
                  {submission.isLate ? (
                    <Badge
                      variant="outline"
                      className="border-amber-600/30 bg-amber-500/15 text-amber-800 dark:text-amber-300"
                    >
                      <Clock className="size-3" />
                      {describeLateness(submission.submittedAt, assessment.dueAt)}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">On time</span>
                  )}
                </div>
                <ul className="mt-2 space-y-1">
                  {submission.files.map((file) => (
                    <li key={file.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">
                        v{file.version} · {formatDateTime(file.submittedAt)}
                        {file.version !== submission.version ? " · superseded" : ""}
                      </span>
                      <Button asChild variant="ghost" size="sm">
                        <a href={`/api/files/${file.id}`}>
                          <Download className="size-3.5" /> {file.fileName}
                        </a>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
