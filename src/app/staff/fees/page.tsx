import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { StatusBadge } from "@/components/badges";
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
import { formatMoney } from "@/lib/money";
import { listFeeRegister } from "@/lib/services/fees";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fee register · SMS Registry" };

export default async function FeesPage() {
  const rows = await listFeeRegister();

  const totals = rows.reduce(
    (acc, r) => ({
      billed: acc.billed + Number(r.billed),
      paid: acc.paid + Number(r.paid),
      outstanding: acc.outstanding + Number(r.outstanding),
      overdue: acc.overdue + Number(r.overdueAmount),
    }),
    { billed: 0, paid: 0, outstanding: 0, overdue: 0 },
  );

  const inArrears = rows.filter((r) => r.isOverdue);

  return (
    <>
      <PageHeader
        title="Fee register"
        description="Every account, sorted by how long it has been overdue. Balances are derived from the payment ledger."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Billed" value={formatMoney(totals.billed)} />
        <SummaryCard label="Collected" value={formatMoney(totals.paid)} />
        <SummaryCard label="Outstanding" value={formatMoney(totals.outstanding)} />
        <SummaryCard
          label="Overdue"
          value={formatMoney(totals.overdue)}
          hint={`${inArrears.length} account${inArrears.length === 1 ? "" : "s"}`}
          tone={totals.overdue > 0 ? "danger" : "default"}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Accounts</CardTitle>
          <CardDescription>
            Withdrawn and completed students still appear while they owe money — they simply cannot
            be billed anything new.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Billed</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className={row.isOverdue ? "bg-rose-500/5" : undefined}>
                  <TableCell>
                    <Link href={`/staff/students/${row.id}`} className="font-medium hover:underline">
                      {row.fullName}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {row.studentId} · {row.programme} · {row.feeCount} fee
                      {row.feeCount === 1 ? "" : "s"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatMoney(row.billed, row.currency)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatMoney(row.paid, row.currency)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {Number(row.outstanding) === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      formatMoney(row.outstanding, row.currency)
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.isOverdue ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-medium text-rose-700 dark:text-rose-400">
                          {formatMoney(row.overdueAmount, row.currency)}
                        </span>
                        <Badge
                          variant="outline"
                          className="border-rose-600/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                        >
                          <AlertTriangle className="size-3" />
                          {row.daysOverdue}d
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "danger";
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={
            tone === "danger"
              ? "mt-1 text-2xl font-semibold text-rose-700 dark:text-rose-400"
              : "mt-1 text-2xl font-semibold"
          }
        >
          {value}
        </p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
