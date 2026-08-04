import { requireSession } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api";
import { getSubmissionFileForUser } from "@/lib/services/assessments";
import { readUpload } from "@/lib/storage";

/**
 * GET /api/files/:id — download a submitted file.
 *
 * Uploads live outside /public precisely so this check runs first: staff may read anything, a
 * student only their own work. The stored name on disk is a UUID, so guessing a URL gets nowhere
 * either.
 */
export async function GET(_request: Request, context: RouteContext<"/api/files/[id]">) {
  try {
    const session = await requireSession();
    const { id } = await context.params;

    const file = await getSubmissionFileForUser(id, {
      role: session.role,
      studentId: session.studentId,
    });

    const bytes = await readUpload(file.storedName);

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": file.mimeType,
        // `inline` so PDFs open in the browser; the quoted filename keeps spaces safe.
        "Content-Disposition": `inline; filename="${file.fileName.replace(/"/g, "")}"`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
