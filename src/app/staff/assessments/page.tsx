import Link from "next/link";
import { CircleCheck, Clock, FilePlus2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { listAssessments } from "@/lib/services/assessments";

export const dynamic = "force-dynamic";
export const metadata = { title: "Assessments · SMS Registry" };

export default async function AssessmentsPage() {
  const assessments = await listAssessments();

  return (
    <>
      <PageHeader
        title="Assessments"
        description="Submission and marking progress for every assessment."
        action={
          <Button asChild>
            <Link href="/staff/assessments/new">
              <FilePlus2 className="size-4" /> Create an assessment
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assessment</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Submissions</TableHead>
                <TableHead>Marked</TableHead>
                <TableHead>Published</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assessments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No assessments yet.
                  </TableCell>
                </TableRow>
              ) : (
                assessments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link
                        href={`/staff/assessments/${a.id}`}
                        className="font-medium hover:underline"
                      >
                        {a.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {a.module.code} — {a.module.title} · {a.module.programme.code} ·{" "}
                        {a.weighting}% of the module
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{formatDateTime(a.dueAt)}</div>
                      {a.isOpen ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-600/25 bg-emerald-500/12 text-emerald-800 dark:text-emerald-300"
                        >
                          Open
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Closed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {a.submissionCount} / {a.cohortSize}
                      </span>
                      {a.lateCount > 0 ? (
                        <Badge
                          variant="outline"
                          className="ml-2 border-amber-600/30 bg-amber-500/15 text-amber-800 dark:text-amber-300"
                        >
                          <Clock className="size-3" />
                          {a.lateCount} late
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      {a.gradedCount} / {a.submissionCount}
                    </TableCell>
                    <TableCell>
                      {a.gradedCount > 0 && a.publishedCount === a.gradedCount ? (
                        <span className="inline-flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-400">
                          <CircleCheck className="size-3.5" /> All released
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {a.publishedCount} of {a.gradedCount}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
