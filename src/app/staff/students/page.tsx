import Link from "next/link";
import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { FeeStateBadge, StatusBadge } from "@/components/badges";
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
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { listStudents, PAGE_SIZE } from "@/lib/services/students";
import { studentFilterSchema } from "@/lib/validation/schemas";
import { StudentFilters } from "./student-filters";

export const dynamic = "force-dynamic";
export const metadata = { title: "Students · SMS Registry" };

export default async function StudentsPage(props: PageProps<"/staff/students">) {
  const searchParams = await props.searchParams;
  // Filters live in the URL, so a filtered register can be bookmarked or sent to a colleague.
  const filter = studentFilterSchema.parse({
    q: first(searchParams.q),
    programmeId: first(searchParams.programmeId),
    status: first(searchParams.status),
    arrears: first(searchParams.arrears),
    page: first(searchParams.page) ?? 1,
    sort: first(searchParams.sort) ?? "name",
  });

  const [{ rows, total, page, pageCount }, programmes] = await Promise.all([
    listStudents(filter),
    // Select only the columns the filter dropdown needs. Passing whole Programme rows would
    // send `defaultFeeAmount` — a Decimal — across the Server/Client boundary, which React
    // cannot serialise.
    prisma.programme.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Student register"
        description="Search by name, registry ID, email, programme or status — or filter precisely with the dropdowns."
        action={
          <Button asChild>
            <Link href="/staff/students/new">
              <UserPlus className="size-4" /> Enrol a student
            </Link>
          </Button>
        }
      />

      <StudentFilters programmes={programmes} />

      <Card className="mt-4">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Registry ID</TableHead>
                <TableHead>Programme</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No students match those filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <Link
                        href={`/staff/students/${student.id}`}
                        className="font-medium hover:underline"
                      >
                        {student.fullName}
                      </Link>
                      <div className="text-xs text-muted-foreground">{student.email}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{student.studentId}</TableCell>
                    <TableCell>
                      <div className="text-sm">{student.programme.code}</div>
                      <div className="text-xs text-muted-foreground">{student.programme.name}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {student.academicYear}
                      <div className="text-xs text-muted-foreground">Year {student.yearOfStudy}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={student.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(student.outstanding) === 0 ? (
                        <span className="text-sm text-muted-foreground">Settled</span>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <span
                            className={
                              student.isOverdue
                                ? "text-sm font-medium text-rose-700 dark:text-rose-400"
                                : "text-sm font-medium"
                            }
                          >
                            {formatMoney(student.outstanding, student.programme.currency)}
                          </span>
                          {student.isOverdue ? (
                            <FeeStateBadge state="OVERDUE" daysOverdue={student.daysOverdue} />
                          ) : null}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <p>
          {total === 0
            ? "No results"
            : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
        </p>
        <div className="flex gap-2">
          <PageLink searchParams={searchParams} page={page - 1} disabled={page <= 1}>
            Previous
          </PageLink>
          <PageLink searchParams={searchParams} page={page + 1} disabled={page >= pageCount}>
            Next
          </PageLink>
        </div>
      </div>
    </>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "" ? undefined : v;
}

function PageLink({
  searchParams,
  page,
  disabled,
  children,
}: {
  searchParams: Record<string, string | string[] | undefined>;
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <Button variant="outline" size="sm" disabled>
        {children}
      </Button>
    );
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (v && key !== "page") params.set(key, v);
  }
  params.set("page", String(page));
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={`/staff/students?${params.toString()}`}>{children}</Link>
    </Button>
  );
}
