"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { toActionError, type ActionResult } from "@/lib/errors";
import {
  changeStatusSchema,
  createStudentSchema,
  fieldErrorsFrom,
  updateStudentSchema,
} from "@/lib/validation/schemas";
import { changeStudentStatus, createStudent, updateStudent } from "@/lib/services/students";

/**
 * Every action re-checks the session: server actions are reachable by direct POST, so `proxy.ts`
 * cannot be the only gate.
 */
export async function createStudentAction(
  _prev: ActionResult<{ id: string; studentId: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string; studentId: string }>> {
  try {
    const session = await requireStaff();
    const parsed = createStudentSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return {
        ok: false,
        error: "Check the highlighted fields",
        code: "VALIDATION_ERROR",
        fieldErrors: fieldErrorsFrom(parsed.error),
      };
    }

    const student = await createStudent(parsed.data, session.userId);
    revalidatePath("/staff/students");
    revalidatePath("/staff");
    return { ok: true, data: { id: student.id, studentId: student.studentId } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateStudentAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    const id = String(formData.get("id") ?? "");
    const parsed = updateStudentSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return {
        ok: false,
        error: "Check the highlighted fields",
        code: "VALIDATION_ERROR",
        fieldErrors: fieldErrorsFrom(parsed.error),
      };
    }

    await updateStudent(id, parsed.data, session.userId);
    revalidatePath(`/staff/students/${id}`);
    revalidatePath("/staff/students");
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function changeStatusAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    const parsed = changeStatusSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return {
        ok: false,
        error: "Check the highlighted fields",
        code: "VALIDATION_ERROR",
        fieldErrors: fieldErrorsFrom(parsed.error),
      };
    }

    await changeStudentStatus(
      parsed.data.studentId,
      parsed.data.status,
      parsed.data.reason,
      session.userId,
    );
    revalidatePath(`/staff/students/${parsed.data.studentId}`);
    revalidatePath("/staff/students");
    revalidatePath("/staff");
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}
