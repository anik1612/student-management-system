import { requireStaff } from "@/lib/auth/session";
import { handleApiError, ok } from "@/lib/api";
import { getDashboard } from "@/lib/services/dashboard";

/** GET /api/dashboard — the same figures the Registry dashboard renders. */
export async function GET() {
  try {
    await requireStaff();
    return ok(await getDashboard());
  } catch (error) {
    return handleApiError(error);
  }
}
