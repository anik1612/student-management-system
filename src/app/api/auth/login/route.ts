import { fail, handleApiError, ok, parseBody } from "@/lib/api";
import { startSession } from "@/lib/auth/session";
import { authenticate } from "@/lib/services/auth";
import { loginSchema } from "@/lib/validation/schemas";

/**
 * POST /api/auth/login — exchanges credentials for the session cookie.
 * The browser UI uses a Server Action; this exists so the REST API can be driven on its own
 * (curl, Postman, integration tests) with the same credentials and the same session.
 */
export async function POST(request: Request) {
  try {
    const body = await parseBody(request, loginSchema);
    if (!body.ok) return body.response;

    const user = await authenticate(body.data.email, body.data.password);
    if (!user) return fail("UNAUTHORISED", "Email address or password is incorrect", 401);

    await startSession(user);
    return ok({ userId: user.userId, name: user.name, role: user.role, studentId: user.studentId });
  } catch (error) {
    return handleApiError(error);
  }
}
