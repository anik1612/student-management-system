"use server";

import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/auth/session";
import { toActionError, validationError, type ActionResult } from "@/lib/errors";
import { submitWork } from "@/lib/services/assessments";

export async function submitWorkAction(
  _prev: ActionResult<{ isLate: boolean; version: number }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ isLate: boolean; version: number }>> {
  try {
    // The session decides whose submission this is — the student ID is never taken from the form.
    const session = await requireStudent();
    const assessmentId = String(formData.get("assessmentId") ?? "");
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      throw validationError("Choose a PDF or DOCX file to upload", { file: ["No file selected"] });
    }

    const result = await submitWork({ assessmentId, studentId: session.studentId, file });

    revalidatePath("/student/assessments");
    revalidatePath("/student");
    return { ok: true, data: { isLate: result.isLate, version: result.version } };
  } catch (error) {
    return toActionError(error);
  }
}
