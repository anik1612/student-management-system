import { Decimal, sum, toDecimal, type MoneyInput } from "@/lib/money";

/**
 * Fee arithmetic. Balances are always derived from the ledger, never read from a stored column.
 */

export type FeeState = "PAID" | "PART_PAID" | "DUE" | "OVERDUE";

export interface FeeLineInput {
  amount: MoneyInput;
  dueDate: Date;
  payments: Array<{ amount: MoneyInput }>;
}

export interface FeeLineBalance {
  billed: Decimal;
  paid: Decimal;
  outstanding: Decimal;
  state: FeeState;
  daysOverdue: number;
}

/** Midnight-normalised day difference: a fee due today is not overdue until tomorrow. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysBetween(from: Date, to: Date): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

export function calculateFeeLine(line: FeeLineInput, now: Date = new Date()): FeeLineBalance {
  const billed = toDecimal(line.amount);
  const paid = sum(line.payments.map((p) => p.amount));
  const outstanding = billed.minus(paid);

  const settled = outstanding.lessThanOrEqualTo(0);
  const overdue = !settled && startOfDay(line.dueDate) < startOfDay(now);

  let state: FeeState;
  if (settled) state = "PAID";
  else if (overdue) state = "OVERDUE";
  else if (paid.greaterThan(0)) state = "PART_PAID";
  else state = "DUE";

  return {
    billed,
    paid,
    outstanding: settled ? new Decimal(0) : outstanding,
    state,
    daysOverdue: overdue ? daysBetween(line.dueDate, now) : 0,
  };
}

export interface AccountSummary {
  billed: Decimal;
  paid: Decimal;
  outstanding: Decimal;
  overdueAmount: Decimal;
  isOverdue: boolean;
  /** Age of the oldest unpaid past-due fee — what Registry sorts its chase list by. */
  maxDaysOverdue: number;
}

export function summariseAccount(lines: FeeLineInput[], now: Date = new Date()): AccountSummary {
  const balances = lines.map((line) => calculateFeeLine(line, now));

  const billed = sum(balances.map((b) => b.billed));
  const paid = sum(balances.map((b) => b.paid));
  const outstanding = sum(balances.map((b) => b.outstanding));
  const overdueLines = balances.filter((b) => b.state === "OVERDUE");

  return {
    billed,
    paid,
    outstanding,
    overdueAmount: sum(overdueLines.map((b) => b.outstanding)),
    isOverdue: overdueLines.length > 0,
    maxDaysOverdue: overdueLines.reduce((max, b) => Math.max(max, b.daysOverdue), 0),
  };
}

export const FEE_STATE_LABEL: Record<FeeState, string> = {
  PAID: "Paid",
  PART_PAID: "Part paid",
  DUE: "Due",
  OVERDUE: "Overdue",
};
