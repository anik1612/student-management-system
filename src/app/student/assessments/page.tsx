import { Download } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ClassificationBadge, LateBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStudent } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatBytes, formatDateTime } from "@/lib/format";
import { describeLateness } from "@/lib/domain/submission-rules";
import { listAssessmentsForStudent } from "@/lib/services/assessments";
import { SubmitWorkForm } from "./submit-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "My assessments · SMS" };

export default async function StudentAssessmentsPage() {
  const session = await requireStudent();
  const [assessments, student] = await Promise.all([
    listAssessmentsForStudent(session.studentId),
    prisma.student.findUniqueOrThrow({ where: { id: session.studentId } }),
  ]);

  return (
    <>
      <PageHeader
        title="Assessments"
        description="PDF or DOCX, up to 10 MB. You can replace your file any time before the deadline."
      />

      {assessments.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No assessments have been set on your programme yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {assessments.map((a) => {
            const closed = !a.isOpen;
            const canReplace = Boolean(a.submission) && a.isOpen;

            return (
              <Card key={a.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{a.title}</CardTitle>
                      <CardDescription>
                        {a.module.code} — {a.module.title} · deadline {formatDateTime(a.dueAt)}
                      </CardDescription>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        a.isOpen
                          ? "border-emerald-600/25 bg-emerald-500/12 text-emerald-800 dark:text-emerald-300"
                          : "text-muted-foreground"
                      }
                    >
                      {a.isOpen ? "Open" : "Closed"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {a.description ? (
                    <p className="text-sm text-muted-foreground">{a.description}</p>
                  ) : null}

                  {a.submission ? (
                    <div className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{a.submission.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            Version {a.submission.version} ·{" "}
                            {formatBytes(a.submission.sizeBytes)} · submitted{" "}
                            {formatDateTime(a.submission.submittedAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {a.submission.isLate ? (
                            <LateBadge
                              label={describeLateness(a.submission.submittedAt, a.dueAt)}
                            />
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-emerald-600/25 bg-emerald-500/12 text-emerald-800 dark:text-emerald-300"
                            >
                              On time
                            </Badge>
                          )}
                          {a.submission.files[0] ? (
                            <Button asChild variant="outline" size="sm">
                              <a href={`/api/files/${a.submission.files[0].id}`}>
                                <Download className="size-3.5" /> Download
                              </a>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      {a.submission.isLate ? (
                        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                          Your work was accepted but is recorded as late. Late submissions cannot be
                          replaced — contact Registry if something is wrong.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {a.grade?.published ? (
                    <div className="flex items-center gap-3 rounded-lg border p-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Result</p>
                        <p className="font-semibold">
                          {a.grade.isAbsent ? "Absent" : `${a.grade.score}/100`}
                        </p>
                      </div>
                      <ClassificationBadge value={a.grade.classification} />
                    </div>
                  ) : a.grade ? (
                    <p className="text-sm text-muted-foreground">
                      Your work has been marked. The result is not yet released.
                    </p>
                  ) : null}

                  {a.canSubmit ? (
                    <SubmitWorkForm
                      assessmentId={a.id}
                      isReplacement={canReplace}
                      dueAt={a.dueAt.toISOString()}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {student.status !== "ENROLLED"
                        ? `Submissions are closed for ${student.status.toLowerCase()} students.`
                        : closed && a.submission
                          ? "The deadline has passed and your submission is recorded."
                          : closed
                            ? "The deadline has passed. Contact Registry if you still need to submit."
                            : "Submissions are closed."}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
