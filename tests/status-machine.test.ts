import { describe, expect, it } from "vitest";
import { EnrolmentStatus } from "@/generated/prisma/enums";
import {
  allowedTransitions,
  canBeBilled,
  canSubmitWork,
  checkTransition,
  isActive,
} from "@/lib/domain/status-machine";

describe("checkTransition", () => {
  it("allows an enrolled student to defer, withdraw or complete", () => {
    expect(checkTransition(EnrolmentStatus.ENROLLED, EnrolmentStatus.DEFERRED, "Medical")).toEqual({
      ok: true,
    });
    expect(checkTransition(EnrolmentStatus.ENROLLED, EnrolmentStatus.WITHDRAWN, "Left")).toEqual({
      ok: true,
    });
    expect(checkTransition(EnrolmentStatus.ENROLLED, EnrolmentStatus.COMPLETED)).toEqual({
      ok: true,
    });
  });

  it("lets a deferred student return", () => {
    expect(checkTransition(EnrolmentStatus.DEFERRED, EnrolmentStatus.ENROLLED)).toEqual({ ok: true });
  });

  it("treats withdrawal and completion as final", () => {
    expect(allowedTransitions(EnrolmentStatus.WITHDRAWN)).toEqual([]);
    expect(allowedTransitions(EnrolmentStatus.COMPLETED)).toEqual([]);

    const result = checkTransition(EnrolmentStatus.WITHDRAWN, EnrolmentStatus.ENROLLED);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/final status/);
  });

  it("requires a reason for withdrawal and deferral", () => {
    const withdrawn = checkTransition(EnrolmentStatus.ENROLLED, EnrolmentStatus.WITHDRAWN);
    expect(withdrawn.ok).toBe(false);

    const blankReason = checkTransition(EnrolmentStatus.ENROLLED, EnrolmentStatus.DEFERRED, "   ");
    expect(blankReason.ok).toBe(false);
  });

  it("does not require a reason to complete", () => {
    expect(checkTransition(EnrolmentStatus.ENROLLED, EnrolmentStatus.COMPLETED).ok).toBe(true);
  });

  it("rejects a no-op transition", () => {
    expect(checkTransition(EnrolmentStatus.ENROLLED, EnrolmentStatus.ENROLLED).ok).toBe(false);
  });

  it("rejects skipping straight from deferred to completed", () => {
    expect(checkTransition(EnrolmentStatus.DEFERRED, EnrolmentStatus.COMPLETED).ok).toBe(false);
  });
});

describe("capability checks", () => {
  it("counts enrolled and deferred students as active", () => {
    expect(isActive(EnrolmentStatus.ENROLLED)).toBe(true);
    expect(isActive(EnrolmentStatus.DEFERRED)).toBe(true);
    expect(isActive(EnrolmentStatus.WITHDRAWN)).toBe(false);
    expect(isActive(EnrolmentStatus.COMPLETED)).toBe(false);
  });

  it("only lets currently enrolled students submit work", () => {
    expect(canSubmitWork(EnrolmentStatus.ENROLLED)).toBe(true);
    // A deferred student is not studying this session, so there is nothing to submit against.
    expect(canSubmitWork(EnrolmentStatus.DEFERRED)).toBe(false);
    expect(canSubmitWork(EnrolmentStatus.WITHDRAWN)).toBe(false);
  });

  it("stops new billing for students who have left, without clearing what they owe", () => {
    expect(canBeBilled(EnrolmentStatus.WITHDRAWN)).toBe(false);
    expect(canBeBilled(EnrolmentStatus.COMPLETED)).toBe(false);
    expect(canBeBilled(EnrolmentStatus.DEFERRED)).toBe(true);
  });
});
