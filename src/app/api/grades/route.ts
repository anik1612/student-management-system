import { requireSession, requireStaff } from "@/lib/auth/session";
import { handleApiError, ok, parseBody } from "@/lib/api";
import { enterGradeSchema } from "@/lib/validation/schemas";
import { enterGrade, getPublishedMarksheet } from "@/lib/services/grades";
import { prisma } from "@/lib/db";

/**
 * GET /api/grades?studentId=
 * A student always gets their published marksheet only, whatever they put in the query string.
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();

    if (session.role === "STUDENT" && session.studentId) {
      return ok(await getPublishedMarksheet(session.studentId));
    }

    const studentId = new URL(request.url).searchParams.get("studentId") ?? undefined;
    const assessmentId = new URL(request.url).searchParams.get("assessmentId") ?? undefined;

    const grades = await prisma.grade.findMany({
      where: { studentId, assessmentId },
      include: {
        student: { select: { studentId: true, firstName: true, lastName: true } },
        assessment: { select: { title: true, module: { select: { code: true } } } },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    return ok(
      grades.map((g) => ({
        id: g.id,
        student: `${g.student.firstName} ${g.student.lastName} (${g.student.studentId})`,
        assessment: `${g.assessment.module.code} — ${g.assessment.title}`,
        score: g.score,
        isAbsent: g.isAbsent,
        classification: g.classification,
        published: g.published,
        withheldReason: g.withheldReason,
      })),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/** PUT /api/grades — enter or amend a mark (upsert on assessment + student). */
export async function PUT(request: Request) {
  try {
    const session = await requireStaff();
    const body = await parseBody(request, enterGradeSchema);
    if (!body.ok) return body.response;

    const grade = await enterGrade(body.data, session.userId);
    return ok({
      id: grade.id,
      score: grade.score,
      isAbsent: grade.isAbsent,
      classification: grade.classification,
      published: grade.published,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
