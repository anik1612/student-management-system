import "server-only";
import { prisma } from "@/lib/db";
import { forbidden, notFound, ruleViolation, validationError } from "@/lib/errors";
import { canSubmitWork, STATUS_LABEL } from "@/lib/domain/status-machine";
import {
  checkResubmission,
  checkUpload,
  isLate,
  MAX_UPLOAD_BYTES,
} from "@/lib/domain/submission-rules";
import { saveUpload } from "@/lib/storage";
import { recordAudit } from "@/lib/services/audit";
import type { createAssessmentSchema } from "@/lib/validation/schemas";
import type { z } from "zod";

type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

export async function createAssessment(input: CreateAssessmentInput, actorId: string) {
  const module = await prisma.module.findUnique({ where: { id: input.moduleId } });
  if (!module) throw validationError("Choose a valid module", { moduleId: ["Unknown module"] });

  // Creating an assessment whose deadline has already passed would make every submission late
  // before anyone could open it.
  if (input.dueAt.getTime() <= Date.now()) {
    throw validationError("The deadline must be in the future", {
      dueAt: ["Pick a date and time in the future"],
    });
  }

  const assessment = await prisma.assessment.create({
    data: {
      title: input.title,
      moduleId: input.moduleId,
      dueAt: input.dueAt,
      weighting: input.weighting,
      description: input.description ?? null,
      createdById: actorId,
    },
  });

  await recordAudit(prisma, {
    actorId,
    action: "assessment.created",
    entityType: "Assessment",
    entityId: assessment.id,
    metadata: { title: assessment.title, module: module.code, dueAt: assessment.dueAt.toISOString() },
  });

  return assessment;
}

export async function listAssessments() {
  const assessments = await prisma.assessment.findMany({
    include: {
      module: { include: { programme: true } },
      submissions: { select: { id: true, isLate: true } },
      grades: { select: { id: true, published: true } },
      _count: { select: { submissions: true, grades: true } },
    },
    orderBy: { dueAt: "desc" },
  });

  const now = new Date();
  return Promise.all(
    assessments.map(async (a) => {
      const cohort = await prisma.student.count({
        where: { programmeId: a.module.programmeId, status: "ENROLLED" },
      });
      return {
        id: a.id,
        title: a.title,
        module: a.module,
        dueAt: a.dueAt,
        weighting: a.weighting,
        isOpen: a.dueAt.getTime() > now.getTime(),
        cohortSize: cohort,
        submissionCount: a.submissions.length,
        lateCount: a.submissions.filter((s) => s.isLate).length,
        gradedCount: a.grades.length,
        publishedCount: a.grades.filter((g) => g.published).length,
      };
    }),
  );
}

export async function getAssessmentDetail(id: string) {
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
      module: { include: { programme: true } },
      submissions: {
        include: { student: true, files: { orderBy: { version: "desc" } } },
        orderBy: { submittedAt: "asc" },
      },
      grades: { include: { student: true } },
    },
  });
  if (!assessment) throw notFound("Assessment");
  return assessment;
}

/** Assessments a given student may submit against: their programme's modules, still relevant. */
export async function listAssessmentsForStudent(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { programme: true },
  });
  if (!student) throw notFound("Student");

  const assessments = await prisma.assessment.findMany({
    where: { module: { programmeId: student.programmeId } },
    include: {
      module: true,
      submissions: { where: { studentId }, include: { files: { orderBy: { version: "desc" } } } },
      grades: { where: { studentId } },
    },
    orderBy: { dueAt: "asc" },
  });

  const now = new Date();
  return assessments.map((a) => {
    const submission = a.submissions[0] ?? null;
    return {
      id: a.id,
      title: a.title,
      module: a.module,
      dueAt: a.dueAt,
      description: a.description,
      isOpen: a.dueAt.getTime() > now.getTime(),
      submission,
      canSubmit:
        canSubmitWork(student.status) &&
        (!submission || a.dueAt.getTime() > now.getTime()),
      grade: a.grades[0] ?? null,
    };
  });
}

export async function submitWork(params: {
  assessmentId: string;
  studentId: string;
  file: File;
}) {
  const [assessment, student] = await Promise.all([
    prisma.assessment.findUnique({
      where: { id: params.assessmentId },
      include: { module: true },
    }),
    prisma.student.findUnique({ where: { id: params.studentId } }),
  ]);
  if (!assessment) throw notFound("Assessment");
  if (!student) throw notFound("Student");

  if (student.programmeId !== assessment.module.programmeId) {
    throw forbidden("This assessment belongs to a programme you are not enrolled on");
  }
  if (!canSubmitWork(student.status)) {
    throw ruleViolation(
      `${STATUS_LABEL[student.status]} students cannot submit work. Contact Registry if this is wrong.`,
    );
  }
  if (params.file.size > MAX_UPLOAD_BYTES) {
    throw validationError(`Files must be ${MAX_UPLOAD_BYTES / 1024 / 1024} MB or smaller`, {
      file: ["File is too large"],
    });
  }

  const bytes = new Uint8Array(await params.file.arrayBuffer());
  const check = checkUpload({
    fileName: params.file.name,
    mimeType: params.file.type,
    sizeBytes: bytes.byteLength,
    head: bytes.subarray(0, 8),
  });
  if (!check.ok) throw validationError(check.reason, { file: [check.reason] });

  const existing = await prisma.submission.findUnique({
    where: { assessmentId_studentId: { assessmentId: assessment.id, studentId: student.id } },
  });

  const now = new Date();
  const resubmission = checkResubmission({
    hasExisting: Boolean(existing),
    now,
    dueAt: assessment.dueAt,
  });
  if (!resubmission.ok) throw ruleViolation(resubmission.reason);

  const late = isLate(now, assessment.dueAt);
  const storedName = await saveUpload(bytes, check.ext);
  const version = existing ? existing.version + 1 : 1;

  const submission = await prisma.$transaction(async (tx) => {
    const saved = existing
      ? await tx.submission.update({
          where: { id: existing.id },
          data: {
            version,
            fileName: params.file.name,
            storedName,
            mimeType: check.mime,
            sizeBytes: bytes.byteLength,
            submittedAt: now,
            isLate: late,
          },
        })
      : await tx.submission.create({
          data: {
            assessmentId: assessment.id,
            studentId: student.id,
            version,
            fileName: params.file.name,
            storedName,
            mimeType: check.mime,
            sizeBytes: bytes.byteLength,
            submittedAt: now,
            isLate: late,
          },
        });

    // The superseded file is kept, so "what did they actually have in by the deadline?" is answerable.
    await tx.submissionFile.create({
      data: {
        submissionId: saved.id,
        version,
        fileName: params.file.name,
        storedName,
        mimeType: check.mime,
        sizeBytes: bytes.byteLength,
        submittedAt: now,
        isLate: late,
      },
    });

    await recordAudit(tx, {
      action: version > 1 ? "submission.resubmitted" : "submission.created",
      entityType: "Submission",
      entityId: saved.id,
      metadata: { assessmentId: assessment.id, studentId: student.id, version, isLate: late },
    });

    return saved;
  });

  return { submission, isLate: late, version };
}

/** Staff download any file; a student only ever their own. */
export async function getSubmissionFileForUser(
  submissionFileId: string,
  viewer: { role: string; studentId?: string },
) {
  const file = await prisma.submissionFile.findUnique({
    where: { id: submissionFileId },
    include: { submission: { include: { student: true, assessment: true } } },
  });
  if (!file) throw notFound("File");

  if (viewer.role !== "STAFF" && file.submission.studentId !== viewer.studentId) {
    throw forbidden("You can only download your own submissions");
  }
  return file;
}
