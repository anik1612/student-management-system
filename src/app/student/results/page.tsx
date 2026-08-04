import { PageHeader } from "@/components/app-shell";
import { ClassificationBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireStudent } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { getPublishedMarksheet } from "@/lib/services/grades";

export const dynamic = "force-dynamic";
export const metadata = { title: "My results · SMS" };

export default async function StudentResultsPage() {
  const session = await requireStudent();
  // Only published rows are fetched — an unreleased mark never reaches this page in any form.
  const { grades, pendingCount, awaitingMark } = await getPublishedMarksheet(session.studentId);

  const marked = grades.filter((g) => !g.isAbsent && g.score !== null);
  const average =
    marked.length > 0
      ? Math.round(marked.reduce((sum, g) => sum + (g.score ?? 0), 0) / marked.length)
      : null;

  return (
    <>
      <PageHeader
        title="Marksheet"
        description="Results appear here once Registry has released them."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Results released</p>
            <p className="mt-1 text-2xl font-semibold">{grades.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Average mark</p>
            <p className="mt-1 text-2xl font-semibold">{average === null ? "—" : `${average}`}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Awaiting release</p>
            <p className="mt-1 text-2xl font-semibold">{pendingCount + awaitingMark}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {awaitingMark > 0 ? `${awaitingMark} still to be marked` : "Marking complete"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Published results</CardTitle>
          <CardDescription>Pass ≥ 40 · Merit ≥ 60 · Distinction ≥ 70</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {grades.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Nothing has been released yet.
              {pendingCount > 0
                ? " Some of your marks are with Registry awaiting release."
                : ""}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assessment</TableHead>
                  <TableHead className="text-right">Mark</TableHead>
                  <TableHead>Classification</TableHead>
                  <TableHead>Released</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grades.map((grade) => (
                  <TableRow key={grade.id}>
                    <TableCell>
                      <p className="font-medium">{grade.assessment.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {grade.assessment.module.code} — {grade.assessment.module.title} ·{" "}
                        {grade.assessment.weighting}% of the module
                      </p>
                      {grade.feedback ? (
                        <p className="mt-1 text-xs text-muted-foreground italic">
                          &ldquo;{grade.feedback}&rdquo;
                        </p>
                      ) : null}
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
                    <TableCell className="text-sm text-muted-foreground">
                      {grade.publishedAt ? formatDate(grade.publishedAt) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pendingCount > 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {pendingCount} result{pendingCount === 1 ? " is" : "s are"} marked but not yet released.
          Results can be held back while an account is in arrears — check the Fees page.
        </p>
      ) : null}
    </>
  );
}
