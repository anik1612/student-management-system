import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { handleApiError, ok, parseBody } from "@/lib/api";
import { publishGradeSchema, publishAssessmentSchema } from "@/lib/validation/schemas";
import { publishAssessmentResults, setGradePublished } from "@/lib/services/grades";

const bodySchema = z.union([publishGradeSchema, publishAssessmentSchema]);

/**
 * POST /api/grades/publish
 *   { gradeId, publish, withheldReason?, overrideArrearsHold? }  — one result
 *   { assessmentId, overrideArrearsHold? }                       — the whole assessment
 *
 * Students in fee arrears are held back (422 for the single case, reported in `heldBack` for the
 * bulk case) unless the caller explicitly overrides the hold.
 */
export async function POST(request: Request) {
  try {
    const session = await requireStaff();
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;

    if ("gradeId" in body.data) {
      const { grade, warning } = await setGradePublished(
        body.data.gradeId,
        body.data.publish,
        {
          withheldReason: body.data.withheldReason,
          overrideArrearsHold: body.data.overrideArrearsHold,
        },
        session.userId,
      );
      return ok({
        id: grade.id,
        published: grade.published,
        publishedAt: grade.publishedAt,
        withheldReason: grade.withheldReason,
        warning,
      });
    }

    const outcome = await publishAssessmentResults(
      body.data.assessmentId,
      body.data.overrideArrearsHold,
      session.userId,
    );
    return ok(outcome);
  } catch (error) {
    return handleApiError(error);
  }
}
