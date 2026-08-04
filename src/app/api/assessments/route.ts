import { requireSession, requireStaff } from "@/lib/auth/session";
import { handleApiError, ok, parseBody } from "@/lib/api";
import { createAssessmentSchema } from "@/lib/validation/schemas";
import { createAssessment, listAssessments, listAssessmentsForStudent } from "@/lib/services/assessments";

/** GET /api/assessments — staff see everything; a student sees only their programme's. */
export async function GET() {
  try {
    const session = await requireSession();
    if (session.role === "STUDENT" && session.studentId) {
      const assessments = await listAssessmentsForStudent(session.studentId);
      return ok(
        assessments.map((a) => ({
          id: a.id,
          title: a.title,
          module: a.module.code,
          dueAt: a.dueAt,
          isOpen: a.isOpen,
          submitted: Boolean(a.submission),
          isLate: a.submission?.isLate ?? false,
          // A grade the student cannot see must not appear in their API payload either.
          result: a.grade?.published
            ? { score: a.grade.score, classification: a.grade.classification }
            : null,
        })),
      );
    }

    return ok(await listAssessments());
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/assessments */
export async function POST(request: Request) {
  try {
    const session = await requireStaff();
    const body = await parseBody(request, createAssessmentSchema);
    if (!body.ok) return body.response;

    const assessment = await createAssessment(body.data, session.userId);
    return ok(
      {
        id: assessment.id,
        title: assessment.title,
        moduleId: assessment.moduleId,
        dueAt: assessment.dueAt,
        weighting: assessment.weighting,
      },
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
