import { requireStaff } from "@/lib/auth/session";
import { handleApiError, ok, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import { recordPaymentSchema } from "@/lib/validation/schemas";
import { serialiseMoney } from "@/lib/money";
import { recordPayment } from "@/lib/services/fees";

/** GET /api/payments?studentId= */
export async function GET(request: Request) {
  try {
    await requireStaff();
    const studentId = new URL(request.url).searchParams.get("studentId") ?? undefined;

    const payments = await prisma.payment.findMany({
      where: studentId ? { feeAssignment: { studentId } } : undefined,
      include: { feeAssignment: { select: { studentId: true, type: true, academicYear: true } } },
      orderBy: { paidOn: "desc" },
      take: 200,
    });

    return ok(
      payments.map((p) => ({
        id: p.id,
        feeAssignmentId: p.feeAssignmentId,
        studentId: p.feeAssignment.studentId,
        amount: serialiseMoney(p.amount),
        paidOn: p.paidOn,
        reference: p.reference,
        method: p.method,
      })),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/payments — records money received.
 * Rejects overpayment (422) and duplicate references (409).
 */
export async function POST(request: Request) {
  try {
    const session = await requireStaff();
    const body = await parseBody(request, recordPaymentSchema);
    if (!body.ok) return body.response;

    const payment = await recordPayment(body.data, session.userId);
    return ok(
      {
        id: payment.id,
        feeAssignmentId: payment.feeAssignmentId,
        amount: serialiseMoney(payment.amount),
        paidOn: payment.paidOn,
        reference: payment.reference,
        method: payment.method,
      },
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
