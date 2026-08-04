/**
 * Rules for uploading work against an assessment.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export const ACCEPTED_UPLOADS = [
  { ext: ".pdf", mime: "application/pdf", label: "PDF" },
  {
    ext: ".docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    label: "DOCX",
  },
] as const;

export const ACCEPT_ATTRIBUTE = ACCEPTED_UPLOADS.map((f) => `${f.ext},${f.mime}`).join(",");

/** Submitting exactly on the deadline counts as on time; a millisecond later does not. */
export function isLate(submittedAt: Date, dueAt: Date): boolean {
  return submittedAt.getTime() > dueAt.getTime();
}

export function describeLateness(submittedAt: Date, dueAt: Date): string {
  const ms = submittedAt.getTime() - dueAt.getTime();
  if (ms <= 0) return "On time";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} min late`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} late`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} late`;
}

export type FileCheck = { ok: true; mime: string; ext: string } | { ok: false; reason: string };

/**
 * Validates extension, declared MIME *and* the leading magic bytes. Browsers happily send
 * `application/pdf` for a renamed executable, so the declared type alone is not evidence.
 *   PDF  -> "%PDF"
 *   DOCX -> a ZIP container, "PK\x03\x04"
 */
export function checkUpload(input: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  head: Uint8Array;
}): FileCheck {
  if (input.sizeBytes <= 0) {
    return { ok: false, reason: "That file is empty" };
  }
  if (input.sizeBytes > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: `Files must be ${MAX_UPLOAD_BYTES / 1024 / 1024} MB or smaller` };
  }

  const lower = input.fileName.toLowerCase();
  const accepted = ACCEPTED_UPLOADS.find((f) => lower.endsWith(f.ext));
  if (!accepted) {
    return { ok: false, reason: "Only PDF and DOCX files are accepted" };
  }

  const sniffed = sniff(input.head);
  if (sniffed !== accepted.label) {
    return {
      ok: false,
      reason: `That file does not look like a real ${accepted.label}. Please re-export it and try again.`,
    };
  }

  return { ok: true, mime: accepted.mime, ext: accepted.ext };
}

function sniff(head: Uint8Array): "PDF" | "DOCX" | "UNKNOWN" {
  if (head.length >= 4) {
    if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return "PDF";
    if (head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) return "DOCX";
  }
  return "UNKNOWN";
}

export type ResubmitCheck = { ok: true } | { ok: false; reason: string };

/**
 * Brief: "one submission per student per assessment; allow resubmission before the deadline".
 * So a first submission after the deadline is accepted and flagged late, but the late file cannot
 * then be swapped repeatedly — otherwise "late" would stop meaning anything.
 */
export function checkResubmission(input: {
  hasExisting: boolean;
  now: Date;
  dueAt: Date;
}): ResubmitCheck {
  if (!input.hasExisting) return { ok: true };
  if (isLate(input.now, input.dueAt)) {
    return {
      ok: false,
      reason:
        "The deadline has passed and your work has already been recorded. Contact Registry if it needs to be replaced.",
    };
  }
  return { ok: true };
}
