"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { toActionError, type ActionResult } from "@/lib/errors";
import {
  createAssessmentSchema,
  enterGradeSchema,
  fieldErrorsFrom,
  publishAssessmentSchema,
  publishGradeSchema,
} from "@/lib/validation/schemas";
import { createAssessment } from "@/lib/services/assessments";
import { enterGrade, publishAssessmentResults, setGradePublished } from "@/lib/services/grades";
import type { PublishOutcome } from "@/lib/services/grades";

export async function createAssessmentAction(
  _prev: ActionResult<{ id: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireStaff();
    const parsed = createAssessmentSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return {
        ok: false,
        error: "Check the highlighted fields",
        code: "VALIDATION_ERROR",
        fieldErrors: fieldErrorsFrom(parsed.error),
      };
    }

    const assessment = await createAssessment(parsed.data, session.userId);
    revalidatePath("/staff/assessments");
    revalidatePath("/staff");
    return { ok: true, data: { id: assessment.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function enterGradeAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    const parsed = enterGradeSchema.safeParse({
      assessmentId: formData.get("assessmentId"),
      studentId: formData.get("studentId"),
      score: formData.get("score"),
      isAbsent: formData.get("isAbsent") === "true",
      feedback: formData.get("feedback") ?? undefined,
    });
    if (!parsed.success) {
      return {
        ok: false,
        error: fieldErrorsFrom(parsed.error).score?.[0] ?? "Check the highlighted fields",
        code: "VALIDATION_ERROR",
        fieldErrors: fieldErrorsFrom(parsed.error),
      };
    }

    await enterGrade(parsed.data, session.userId);
    revalidatePath(`/staff/assessments/${parsed.data.assessmentId}`);
    revalidatePath(`/staff/students/${parsed.data.studentId}`);
    revalidatePath("/staff");
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setGradePublishedAction(
  _prev: ActionResult<{ warning?: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ warning?: string }>> {
  try {
    const session = await requireStaff();
    const parsed = publishGradeSchema.safeParse({
      gradeId: formData.get("gradeId"),
      publish: formData.get("publish") === "true",
      withheldReason: formData.get("withheldReason") ?? undefined,
      overrideArrearsHold: formData.get("overrideArrearsHold") === "true",
    });
    if (!parsed.success) {
      return { ok: false, error: "Could not update that result", code: "VALIDATION_ERROR" };
    }

    const { warning } = await setGradePublished(
      parsed.data.gradeId,
      parsed.data.publish,
      {
        withheldReason: parsed.data.withheldReason,
        overrideArrearsHold: parsed.data.overrideArrearsHold,
      },
      session.userId,
    );

    const assessmentId = String(formData.get("assessmentId") ?? "");
    if (assessmentId) revalidatePath(`/staff/assessments/${assessmentId}`);
    revalidatePath("/staff");
    return { ok: true, data: { warning } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function publishAssessmentAction(
  _prev: ActionResult<PublishOutcome> | undefined,
  formData: FormData,
): Promise<ActionResult<PublishOutcome>> {
  try {
    const session = await requireStaff();
    const parsed = publishAssessmentSchema.safeParse({
      assessmentId: formData.get("assessmentId"),
      overrideArrearsHold: formData.get("overrideArrearsHold") === "true",
    });
    if (!parsed.success) {
      return { ok: false, error: "Could not publish these results", code: "VALIDATION_ERROR" };
    }

    const outcome = await publishAssessmentResults(
      parsed.data.assessmentId,
      parsed.data.overrideArrearsHold,
      session.userId,
    );
    revalidatePath(`/staff/assessments/${parsed.data.assessmentId}`);
    revalidatePath("/staff");
    return { ok: true, data: outcome };
  } catch (error) {
    return toActionError(error);
  }
}
