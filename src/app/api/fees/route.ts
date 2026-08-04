import { requireStaff } from "@/lib/auth/session";
import { handleApiError, ok, parseBody } from "@/lib/api";
import { assignFeeSchema } from "@/lib/validation/schemas";
import { serialiseMoney } from "@/lib/money";
import { assignFee, listFeeRegister } from "@/lib/services/fees";

/** GET /api/fees — the whole fee register with derived balances. */
export async function GET() {
  try {
    await requireStaff();
    return ok(await listFeeRegister());
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/fees — raise a fee against a student. */
export async function POST(request: Request) {
  try {
    const session = await requireStaff();
    const body = await parseBody(request, assignFeeSchema);
    if (!body.ok) return body.response;

    const fee = await assignFee(body.data, session.userId);
    return ok(
      {
        id: fee.id,
        studentId: fee.studentId,
        type: fee.type,
        amount: serialiseMoney(fee.amount),
        academicYear: fee.academicYear,
        dueDate: fee.dueDate,
        overrideNote: fee.overrideNote,
      },
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
