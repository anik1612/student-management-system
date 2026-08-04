import { handleApiError, ok } from "@/lib/api";
import { endSession } from "@/lib/auth/session";

/** POST /api/auth/logout — clears the session cookie. */
export async function POST() {
  try {
    await endSession();
    return ok({ signedOut: true });
  } catch (error) {
    return handleApiError(error);
  }
}
