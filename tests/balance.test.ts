import { describe, expect, it } from "vitest";
import { calculateFeeLine, daysBetween, summariseAccount } from "@/lib/domain/balance";

const NOW = new Date("2026-08-04T10:00:00Z");
const date = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("calculateFeeLine", () => {
  it("reports an unpaid, not-yet-due fee as due", () => {
    const result = calculateFeeLine(
      { amount: "9250.00", dueDate: date("2026-10-01"), payments: [] },
      NOW,
    );
    expect(result.state).toBe("DUE");
    expect(result.outstanding.toFixed(2)).toBe("9250.00");
    expect(result.daysOverdue).toBe(0);
  });

  it("reports a partly paid, not-yet-due fee as part paid", () => {
    const result = calculateFeeLine(
      { amount: "9250.00", dueDate: date("2026-10-01"), payments: [{ amount: "250.00" }] },
      NOW,
    );
    expect(result.state).toBe("PART_PAID");
    expect(result.outstanding.toFixed(2)).toBe("9000.00");
  });

  it("reports a past-due unpaid fee as overdue with its age", () => {
    const result = calculateFeeLine(
      { amount: "9250.00", dueDate: date("2026-06-30"), payments: [{ amount: "250.00" }] },
      NOW,
    );
    expect(result.state).toBe("OVERDUE");
    expect(result.daysOverdue).toBe(35);
  });

  it("is not overdue on the due date itself — only from the next day", () => {
    const dueToday = calculateFeeLine(
      { amount: "100.00", dueDate: date("2026-08-04"), payments: [] },
      NOW,
    );
    expect(dueToday.state).toBe("DUE");

    const dueYesterday = calculateFeeLine(
      { amount: "100.00", dueDate: date("2026-08-03"), payments: [] },
      NOW,
    );
    expect(dueYesterday.state).toBe("OVERDUE");
    expect(dueYesterday.daysOverdue).toBe(1);
  });

  it("marks a fully paid fee as paid even when the due date has passed", () => {
    const result = calculateFeeLine(
      {
        amount: "9250.00",
        dueDate: date("2025-10-01"),
        payments: [{ amount: "4625.00" }, { amount: "4625.00" }],
      },
      NOW,
    );
    expect(result.state).toBe("PAID");
    expect(result.outstanding.toFixed(2)).toBe("0.00");
  });

  it("never reports a negative outstanding balance", () => {
    const result = calculateFeeLine(
      { amount: "100.00", dueDate: date("2026-01-01"), payments: [{ amount: "150.00" }] },
      NOW,
    );
    expect(result.outstanding.toFixed(2)).toBe("0.00");
    expect(result.state).toBe("PAID");
  });

  it("adds instalments exactly — no floating point drift", () => {
    // 0.1 + 0.2 !== 0.3 in binary floating point; Decimal has to get this right.
    const result = calculateFeeLine(
      {
        amount: "0.30",
        dueDate: date("2026-10-01"),
        payments: [{ amount: "0.10" }, { amount: "0.20" }],
      },
      NOW,
    );
    expect(result.outstanding.toFixed(2)).toBe("0.00");
    expect(result.state).toBe("PAID");
  });
});

describe("summariseAccount", () => {
  it("aggregates several fee lines and flags the oldest arrears", () => {
    const summary = summariseAccount(
      [
        { amount: "9250.00", dueDate: date("2026-05-01"), payments: [{ amount: "3000.00" }] },
        { amount: "250.00", dueDate: date("2026-07-01"), payments: [] },
        { amount: "500.00", dueDate: date("2026-12-01"), payments: [] },
      ],
      NOW,
    );

    expect(summary.billed.toFixed(2)).toBe("10000.00");
    expect(summary.paid.toFixed(2)).toBe("3000.00");
    expect(summary.outstanding.toFixed(2)).toBe("7000.00");
    // Only the two past-due lines count towards arrears; the December fee does not.
    expect(summary.overdueAmount.toFixed(2)).toBe("6500.00");
    expect(summary.isOverdue).toBe(true);
    expect(summary.maxDaysOverdue).toBe(95);
  });

  it("handles a student with no fees at all", () => {
    const summary = summariseAccount([], NOW);
    expect(summary.outstanding.toFixed(2)).toBe("0.00");
    expect(summary.isOverdue).toBe(false);
  });
});

describe("daysBetween", () => {
  // Counted in whole local days: "3 days overdue" has to mean the same thing to a registrar at
  // 09:00 as it does at 17:00, so the clock time is normalised away before subtracting.
  it("ignores the time of day within the same local day", () => {
    expect(daysBetween(new Date(2026, 7, 1, 0, 1), new Date(2026, 7, 1, 23, 59))).toBe(0);
  });

  it("counts a rollover past local midnight as one day", () => {
    expect(daysBetween(new Date(2026, 7, 1, 23, 59), new Date(2026, 7, 2, 0, 1))).toBe(1);
  });

  it("counts across a longer span", () => {
    expect(daysBetween(new Date(2026, 6, 30, 8, 0), new Date(2026, 7, 4, 17, 0))).toBe(5);
  });
});
