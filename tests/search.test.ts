import { describe, expect, it } from "vitest";
import { EnrolmentStatus } from "@/generated/prisma/enums";
import { matchStatuses } from "@/lib/domain/status-machine";

/**
 * The brief asks for search "by name, ID, programme, or status". Name/ID/programme are ordinary
 * text columns; status is an enum, so free text has to be resolved to the matching statuses
 * before it can be queried. That resolution is what these cover.
 */
describe("matchStatuses", () => {
  it("matches a full status name regardless of case", () => {
    expect(matchStatuses("completed")).toEqual([EnrolmentStatus.COMPLETED]);
    expect(matchStatuses("Completed")).toEqual([EnrolmentStatus.COMPLETED]);
    expect(matchStatuses("ENROLLED")).toEqual([EnrolmentStatus.ENROLLED]);
  });

  it("matches a partial word, so half-typed searches still find people", () => {
    expect(matchStatuses("withdraw")).toEqual([EnrolmentStatus.WITHDRAWN]);
    expect(matchStatuses("defer")).toEqual([EnrolmentStatus.DEFERRED]);
  });

  it("returns every status the text could mean", () => {
    // "ed" appears in Enrolled, Deferred, Withdrawn and Completed.
    expect(matchStatuses("ed").length).toBeGreaterThan(1);
  });

  it("returns nothing for text that is not a status", () => {
    expect(matchStatuses("okafor")).toEqual([]);
    expect(matchStatuses("SMS-2025-0001")).toEqual([]);
    expect(matchStatuses("")).toEqual([]);
    expect(matchStatuses("   ")).toEqual([]);
  });
});
