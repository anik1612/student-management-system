import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { FeeStateBadge } from "@/components/badges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireStudent } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { getStudentAccount } from "@/lib/services/fees";

export const dynamic = "force-dynamic";
export const metadata = { title: "My fees · SMS" };

export default async function StudentFeesPage() {
  const session = await requireStudent();
  const account = await getStudentAccount(session.studentId);

  return (
    <>
      <PageHeader
        title="Fees"
        description="Everything you have been billed, and everything received against it."
      />

      {account.summary.isOverdue ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="size-4" />
          <AlertTitle>{formatMoney(account.summary.overdueAmount)} overdue</AlertTitle>
          <AlertDescription>
            Please contact Registry to arrange payment. Results can be withheld while an account is
            in arrears.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Billed</p>
            <p className="mt-1 text-2xl font-semibold">{formatMoney(account.summary.billed)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Paid</p>
            <p className="mt-1 text-2xl font-semibold">{formatMoney(account.summary.paid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Outstanding</p>
            <p
              className={
                account.summary.isOverdue
                  ? "mt-1 text-2xl font-semibold text-rose-700 dark:text-rose-400"
                  : "mt-1 text-2xl font-semibold"
              }
            >
              {formatMoney(account.summary.outstanding)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Statement</CardTitle>
          <CardDescription>Fee lines with the payments recorded against each.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {account.lines.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No fees have been raised for you yet.
            </p>
          ) : (
            account.lines.map((line) => (
              <div key={line.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{line.description ?? line.type.replace("_", " ")}</p>
                      <FeeStateBadge state={line.state} daysOverdue={line.daysOverdue} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {line.academicYear} · due {formatDate(line.dueDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatMoney(line.outstanding, line.currency)}</p>
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
                      {line.payments.map((payment) => (
                        <li key={payment.id} className="flex justify-between gap-3">
                          <span className="text-muted-foreground">
                            {formatDate(payment.paidOn)} ·{" "}
                            {payment.method.replace("_", " ").toLowerCase()} ·{" "}
                            <span className="font-mono text-xs">{payment.reference}</span>
                          </span>
                          <span>{formatMoney(payment.amount, line.currency)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">No payments recorded yet.</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
