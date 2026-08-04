import { describe, expect, it } from "vitest";
import {
  academicYearForDate,
  academicYearOptions,
  formatStudentId,
  intakeYearFromAcademicYear,
  parseStudentId,
} from "@/lib/domain/student-id";

describe("formatStudentId", () => {
  it("zero-pads the sequence to four digits", () => {
    expect(formatStudentId(2026, 1)).toBe("SMS-2026-0001");
    expect(formatStudentId(2026, 42)).toBe("SMS-2026-0042");
    expect(formatStudentId(2025, 9999)).toBe("SMS-2025-9999");
  });

  it("grows rather than wrapping past the four-digit range", () => {
    expect(formatStudentId(2026, 10_000)).toBe("SMS-2026-10000");
  });

  it("rejects nonsense input", () => {
    expect(() => formatStudentId(2026, 0)).toThrow(RangeError);
    expect(() => formatStudentId(26, 1)).toThrow(RangeError);
  });
});

describe("parseStudentId", () => {
  it("round-trips a formatted ID", () => {
    expect(parseStudentId("SMS-2026-0042")).toEqual({ year: 2026, sequence: 42 });
  });

  it("is case-insensitive and tolerates whitespace", () => {
    expect(parseStudentId("  sms-2026-0042 ")).toEqual({ year: 2026, sequence: 42 });
  });

  it("returns null for anything that is not a registry ID", () => {
    expect(parseStudentId("okafor")).toBeNull();
    expect(parseStudentId("SMS-26-1")).toBeNull();
  });
});

describe("academicYearForDate", () => {
  it("rolls the session over on 1 August", () => {
    expect(academicYearForDate(new Date("2026-07-31T12:00:00Z"))).toBe("2025/26");
    expect(academicYearForDate(new Date("2026-08-01T12:00:00Z"))).toBe("2026/27");
  });

  it("pads the second half of the label", () => {
    expect(academicYearForDate(new Date("2099-09-01T12:00:00Z"))).toBe("2099/00");
  });
});

describe("intakeYearFromAcademicYear", () => {
  it("takes the year the session started", () => {
    expect(intakeYearFromAcademicYear("2026/27")).toBe(2026);
  });

  it("rejects a malformed session label", () => {
    expect(() => intakeYearFromAcademicYear("2026")).toThrow(RangeError);
  });
});

describe("academicYearOptions", () => {
  it("offers the previous, current and next session", () => {
    expect(academicYearOptions(new Date("2026-08-04T12:00:00Z"))).toEqual([
      "2025/26",
      "2026/27",
      "2027/28",
    ]);
  });
});
