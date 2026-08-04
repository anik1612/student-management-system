import { Classification } from "@/generated/prisma/enums";

/**
 * Assessment brief: Pass >= 40, Merit >= 60, Distinction >= 70. Anything below 40 is a Fail —
 * the brief does not name that band, but a marksheet has to show *something*, and "no
 * classification" would be indistinguishable from "not yet marked".
 */
export const CLASSIFICATION_BANDS = [
  { min: 70, value: Classification.DISTINCTION, label: "Distinction" },
  { min: 60, value: Classification.MERIT, label: "Merit" },
  { min: 40, value: Classification.PASS, label: "Pass" },
  { min: 0, value: Classification.FAIL, label: "Fail" },
] as const;

export const MIN_SCORE = 0;
export const MAX_SCORE = 100;

export function classify(score: number): Classification {
  if (!Number.isInteger(score) || score < MIN_SCORE || score > MAX_SCORE) {
    throw new RangeError(`Score must be an integer between ${MIN_SCORE} and ${MAX_SCORE}`);
  }
  return CLASSIFICATION_BANDS.find((band) => score >= band.min)!.value;
}

export function classificationLabel(classification: Classification | null): string {
  if (!classification) return "—";
  return CLASSIFICATION_BANDS.find((b) => b.value === classification)?.label ?? "—";
}

export function isPassing(classification: Classification | null): boolean {
  return classification !== null && classification !== Classification.FAIL;
}

/** Absent students are recorded as absent, not as a mark of zero — the two mean different things. */
export function classifyResult(input: { score: number | null; isAbsent: boolean }): Classification | null {
  if (input.isAbsent) return Classification.FAIL;
  if (input.score === null) return null;
  return classify(input.score);
}
