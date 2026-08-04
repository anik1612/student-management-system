import { describe, expect, it } from "vitest";
import {
  checkResubmission,
  checkUpload,
  describeLateness,
  isLate,
  MAX_UPLOAD_BYTES,
} from "@/lib/domain/submission-rules";

const DUE = new Date("2026-08-20T23:59:00Z");
const PDF_HEAD = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // "%PDF-1.4"
const ZIP_HEAD = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]); // DOCX container
const EXE_HEAD = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // "MZ" — a PE binary

describe("isLate", () => {
  it("treats a submission exactly on the deadline as on time", () => {
    expect(isLate(new Date(DUE), DUE)).toBe(false);
  });

  it("treats one millisecond past the deadline as late", () => {
    expect(isLate(new Date(DUE.getTime() + 1), DUE)).toBe(true);
  });

  it("treats an early submission as on time", () => {
    expect(isLate(new Date(DUE.getTime() - 86_400_000), DUE)).toBe(false);
  });
});

describe("describeLateness", () => {
  it("describes minutes, hours and days", () => {
    expect(describeLateness(new Date(DUE.getTime() + 5 * 60_000), DUE)).toBe("5 min late");
    expect(describeLateness(new Date(DUE.getTime() + 3 * 3_600_000), DUE)).toBe("3 hrs late");
    expect(describeLateness(new Date(DUE.getTime() + 2 * 86_400_000), DUE)).toBe("2 days late");
    expect(describeLateness(new Date(DUE.getTime() + 86_400_000), DUE)).toBe("1 day late");
  });

  it("says on time when it is not late", () => {
    expect(describeLateness(new Date(DUE.getTime() - 1), DUE)).toBe("On time");
  });
});

describe("checkUpload", () => {
  it("accepts a real PDF", () => {
    const result = checkUpload({
      fileName: "essay.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      head: PDF_HEAD,
    });
    expect(result).toMatchObject({ ok: true, mime: "application/pdf", ext: ".pdf" });
  });

  it("accepts a real DOCX", () => {
    const result = checkUpload({
      fileName: "report.DOCX",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sizeBytes: 2048,
      head: ZIP_HEAD,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an executable renamed to .pdf, whatever MIME type the browser claims", () => {
    const result = checkUpload({
      fileName: "totally-an-essay.pdf",
      mimeType: "application/pdf",
      sizeBytes: 4096,
      head: EXE_HEAD,
    });
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects unsupported extensions", () => {
    const result = checkUpload({
      fileName: "notes.txt",
      mimeType: "text/plain",
      sizeBytes: 10,
      head: PDF_HEAD,
    });
    expect(result).toMatchObject({ ok: false, reason: "Only PDF and DOCX files are accepted" });
  });

  it("rejects empty and oversized files", () => {
    expect(
      checkUpload({ fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 0, head: PDF_HEAD }),
    ).toMatchObject({ ok: false });

    expect(
      checkUpload({
        fileName: "a.pdf",
        mimeType: "application/pdf",
        sizeBytes: MAX_UPLOAD_BYTES + 1,
        head: PDF_HEAD,
      }),
    ).toMatchObject({ ok: false });
  });
});

describe("checkResubmission", () => {
  it("allows a first submission at any time — including after the deadline", () => {
    expect(checkResubmission({ hasExisting: false, now: new Date(DUE.getTime() + 1), dueAt: DUE }))
      .toEqual({ ok: true });
  });

  it("allows replacing work before the deadline", () => {
    expect(checkResubmission({ hasExisting: true, now: new Date(DUE.getTime() - 1), dueAt: DUE }))
      .toEqual({ ok: true });
  });

  it("refuses to replace work once the deadline has passed", () => {
    const result = checkResubmission({
      hasExisting: true,
      now: new Date(DUE.getTime() + 60_000),
      dueAt: DUE,
    });
    expect(result.ok).toBe(false);
  });
});
