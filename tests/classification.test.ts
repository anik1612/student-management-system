import { describe, expect, it } from "vitest";
import { Classification } from "@/generated/prisma/enums";
import { classify, classifyResult, isPassing } from "@/lib/domain/classification";

describe("classify", () => {
  // The boundaries are where classification bugs actually live, so every one is pinned.
  it.each([
    [0, Classification.FAIL],
    [39, Classification.FAIL],
    [40, Classification.PASS],
    [59, Classification.PASS],
    [60, Classification.MERIT],
    [69, Classification.MERIT],
    [70, Classification.DISTINCTION],
    [100, Classification.DISTINCTION],
  ])("classifies %i as %s", (score, expected) => {
    expect(classify(score)).toBe(expected);
  });

  it("rejects marks outside 0–100", () => {
    expect(() => classify(-1)).toThrow(RangeError);
    expect(() => classify(101)).toThrow(RangeError);
  });

  it("rejects fractional marks", () => {
    expect(() => classify(65.5)).toThrow(RangeError);
  });
});

describe("classifyResult", () => {
  it("treats an absence as a fail without inventing a score", () => {
    expect(classifyResult({ score: null, isAbsent: true })).toBe(Classification.FAIL);
  });

  it("returns null when nothing has been marked yet", () => {
    expect(classifyResult({ score: null, isAbsent: false })).toBeNull();
  });

  it("ignores a stray score when the student is recorded absent", () => {
    expect(classifyResult({ score: 80, isAbsent: true })).toBe(Classification.FAIL);
  });
});

describe("isPassing", () => {
  it("counts pass, merit and distinction as passing", () => {
    expect(isPassing(Classification.PASS)).toBe(true);
    expect(isPassing(Classification.MERIT)).toBe(true);
    expect(isPassing(Classification.DISTINCTION)).toBe(true);
    expect(isPassing(Classification.FAIL)).toBe(false);
    expect(isPassing(null)).toBe(false);
  });
});
