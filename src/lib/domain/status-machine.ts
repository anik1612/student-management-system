import { EnrolmentStatus } from "@/generated/prisma/enums";

/**
 * Enrolment status transitions.
 *
 * WITHDRAWN and COMPLETED are terminal on purpose. A student who withdraws and comes back next
 * year is a *new* enrolment record — reopening the old one would erase the fact that they left,
 * which is exactly the fact Registry gets audited on. Reinstating a mistake is a separate
 * corrections process, not a status click.
 */
const ALLOWED: Record<EnrolmentStatus, EnrolmentStatus[]> = {
  ENROLLED: [EnrolmentStatus.DEFERRED, EnrolmentStatus.WITHDRAWN, EnrolmentStatus.COMPLETED],
  DEFERRED: [EnrolmentStatus.ENROLLED, EnrolmentStatus.WITHDRAWN],
  WITHDRAWN: [],
  COMPLETED: [],
};

/** Statuses that require a written reason before Registry can save the change. */
const REASON_REQUIRED: EnrolmentStatus[] = [EnrolmentStatus.WITHDRAWN, EnrolmentStatus.DEFERRED];

export function allowedTransitions(from: EnrolmentStatus): EnrolmentStatus[] {
  return ALLOWED[from];
}

export function requiresReason(to: EnrolmentStatus): boolean {
  return REASON_REQUIRED.includes(to);
}

export type TransitionCheck = { ok: true } | { ok: false; reason: string };

export function checkTransition(
  from: EnrolmentStatus,
  to: EnrolmentStatus,
  reason?: string | null,
): TransitionCheck {
  if (from === to) {
    return { ok: false, reason: `Student is already ${STATUS_LABEL[to].toLowerCase()}` };
  }
  if (!ALLOWED[from].includes(to)) {
    const options = ALLOWED[from];
    return {
      ok: false,
      reason: options.length
        ? `Cannot move a ${STATUS_LABEL[from].toLowerCase()} student to ${STATUS_LABEL[to].toLowerCase()}. Allowed: ${options.map((s) => STATUS_LABEL[s]).join(", ")}.`
        : `${STATUS_LABEL[from]} is a final status and cannot be changed. Create a new enrolment record instead.`,
    };
  }
  if (requiresReason(to) && !reason?.trim()) {
    return { ok: false, reason: `A reason is required when marking a student ${STATUS_LABEL[to].toLowerCase()}` };
  }
  return { ok: true };
}

/** Only currently-active students can be billed for new fees or submit work. */
export function isActive(status: EnrolmentStatus): boolean {
  return status === EnrolmentStatus.ENROLLED || status === EnrolmentStatus.DEFERRED;
}

/** Deferred students are not studying this session, so they cannot submit against a deadline. */
export function canSubmitWork(status: EnrolmentStatus): boolean {
  return status === EnrolmentStatus.ENROLLED;
}

/**
 * A withdrawn student still owes what they were billed before leaving, so they stay on the arrears
 * report — they just cannot be billed anything new.
 */
export function canBeBilled(status: EnrolmentStatus): boolean {
  return isActive(status);
}

export const STATUS_LABEL: Record<EnrolmentStatus, string> = {
  ENROLLED: "Enrolled",
  DEFERRED: "Deferred",
  WITHDRAWN: "Withdrawn",
  COMPLETED: "Completed",
};

/**
 * Statuses whose enum value or human label contains the typed text.
 *
 * The register's search box is expected to cover status as well as name, ID and programme, but
 * status is an enum rather than a text column — so free text has to be resolved to the statuses
 * it could mean before it can be queried. "completed", "Withdraw" and "defer" all find people.
 */
export function matchStatuses(query: string): EnrolmentStatus[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return Object.values(EnrolmentStatus).filter(
    (status) =>
      status.toLowerCase().includes(q) || STATUS_LABEL[status].toLowerCase().includes(q),
  );
}
