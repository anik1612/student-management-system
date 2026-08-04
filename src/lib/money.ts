import { Decimal } from "decimal.js";

/**
 * Money helpers. Everything monetary stays in Decimal until the moment it is rendered — a fee
 * ledger built on JS floats will eventually report a balance of 0.000000001 as outstanding.
 *
 * decimal.js is used directly rather than `Prisma.Decimal` so this module (and the domain code
 * that depends on it) can also be imported by Client Components without dragging the Prisma
 * runtime into the browser bundle.
 */

export type MoneyInput = Decimal | string | number | { toString(): string };

export const ZERO = new Decimal(0);

export function toDecimal(value: MoneyInput): Decimal {
  if (value instanceof Decimal) return value;
  if (typeof value === "number" || typeof value === "string") return new Decimal(value);
  // Prisma returns its own Decimal class; round-trip via string so the two stay compatible.
  return new Decimal(value.toString());
}

export function sum(values: MoneyInput[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(toDecimal(v)), new Decimal(0));
}

/** Decimals cannot cross the server/client boundary — serialise to a plain "1234.50" string. */
export function serialiseMoney(value: MoneyInput | null | undefined): string {
  if (value === null || value === undefined) return "0.00";
  return toDecimal(value).toFixed(2);
}

const FORMATTERS = new Map<string, Intl.NumberFormat>();

export function formatMoney(value: MoneyInput | null | undefined, currency = "GBP"): string {
  let formatter = FORMATTERS.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    });
    FORMATTERS.set(currency, formatter);
  }
  return formatter.format(Number(serialiseMoney(value)));
}

export { Decimal };
