"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { toActionError, type ActionResult } from "@/lib/errors";
import { assignFeeSchema, fieldErrorsFrom, recordPaymentSchema } from "@/lib/validation/schemas";
import { assignFee, recordPayment } from "@/lib/services/fees";

export async function assignFeeAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    const parsed = assignFeeSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return {
        ok: false,
        error: "Check the highlighted fields",
        code: "VALIDATION_ERROR",
        fieldErrors: fieldErrorsFrom(parsed.error),
      };
    }

    await assignFee(parsed.data, session.userId);
    revalidatePath(`/staff/students/${parsed.data.studentId}`);
    revalidatePath("/staff/fees");
    revalidatePath("/staff");
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function recordPaymentAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    const parsed = recordPaymentSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return {
        ok: false,
        error: "Check the highlighted fields",
        code: "VALIDATION_ERROR",
        fieldErrors: fieldErrorsFrom(parsed.error),
      };
    }

    await recordPayment(parsed.data, session.userId);
    const studentId = String(formData.get("redirectStudentId") ?? "");
    if (studentId) revalidatePath(`/staff/students/${studentId}`);
    revalidatePath("/staff/fees");
    revalidatePath("/staff");
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}
