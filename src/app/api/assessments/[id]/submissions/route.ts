import { requireSession, requireStudent } from "@/lib/auth/session";
import { handleApiError, ok, fail } from "@/lib/api";
import { getAssessmentDetail, submitWork } from "@/lib/services/assessments";
import { describeLateness } from "@/lib/domain/submission-rules";

/** GET /api/assessments/:id/submissions — staff only; the marking view. */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/assessments/[id]/submissions">,
) {
  try {
    const session = await requireSession();
    if (session.role !== "STAFF") return fail("FORBIDDEN", "Registry staff only", 403);

    const { id } = await context.params;
    const assessment = await getAssessmentDetail(id);

    return ok(
      assessment.submissions.map((s) => ({
        id: s.id,
        studentId: s.student.studentId,
        studentName: `${s.student.firstName} ${s.student.lastName}`,
        fileName: s.fileName,
        fileId: s.files[0]?.id ?? null,
        version: s.version,
        submittedAt: s.submittedAt,
        isLate: s.isLate,
        lateness: describeLateness(s.submittedAt, assessment.dueAt),
      })),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/assessments/:id/submissions — multipart upload of the student's own work.
 * The student is taken from the session, never from the request body.
 */
export async function POST(
  request: Request,
  context: RouteContext<"/api/assessments/[id]/submissions">,
) {
  try {
    const session = await requireStudent();
    const { id } = await context.params;

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return fail("VALIDATION_ERROR", "Attach a PDF or DOCX file as `file`", 400, {
        file: ["No file supplied"],
      });
    }

    const result = await submitWork({
      assessmentId: id,
      studentId: session.studentId,
      file,
    });

    return ok(
      {
        id: result.submission.id,
        version: result.version,
        isLate: result.isLate,
        fileName: result.submission.fileName,
        submittedAt: result.submission.submittedAt,
      },
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
