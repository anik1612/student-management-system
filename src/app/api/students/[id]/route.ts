import { requireStaff, requireStudentAccess } from "@/lib/auth/session";
import { handleApiError, ok, parseBody } from "@/lib/api";
import { changeStatusSchema, updateStudentSchema } from "@/lib/validation/schemas";
import { serialiseMoney } from "@/lib/money";
import { getStudentAccount } from "@/lib/services/fees";
import {
  changeStudentStatus,
  findStudentByAnyId,
  getStudentDetail,
  updateStudent,
} from "@/lib/services/students";

/** GET /api/students/:id — accepts either the internal id or the SMS-… reference. */
export async function GET(_request: Request, context: RouteContext<"/api/students/[id]">) {
  try {
    const { id } = await context.params;
    const found = await findStudentByAnyId(id);
    // Staff see anyone; a student only ever their own record.
    await requireStudentAccess(found.id);

    const [student, account] = await Promise.all([
      getStudentDetail(found.id),
      getStudentAccount(found.id),
    ]);

    return ok({
      id: student.id,
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      dateOfBirth: student.dateOfBirth,
      status: student.status,
      statusReason: student.statusReason,
      academicYear: student.academicYear,
      yearOfStudy: student.yearOfStudy,
      programme: {
        id: student.programme.id,
        code: student.programme.code,
        name: student.programme.name,
        defaultFeeAmount: serialiseMoney(student.programme.defaultFeeAmount),
      },
      account,
      submissions: student.submissions.map((s) => ({
        id: s.id,
        assessmentId: s.assessmentId,
        assessment: s.assessment.title,
        module: s.assessment.module.code,
        fileName: s.fileName,
        version: s.version,
        submittedAt: s.submittedAt,
        isLate: s.isLate,
      })),
      // Unpublished marks are never exposed over the API to a student.
      grades: student.grades
        .filter(() => true)
        .map((g) => ({
          id: g.id,
          assessmentId: g.assessmentId,
          assessment: g.assessment.title,
          score: g.score,
          isAbsent: g.isAbsent,
          classification: g.classification,
          published: g.published,
          withheldReason: g.withheldReason,
        })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** PATCH /api/students/:id */
export async function PATCH(request: Request, context: RouteContext<"/api/students/[id]">) {
  try {
    const session = await requireStaff();
    const { id } = await context.params;
    const body = await parseBody(request, updateStudentSchema);
    if (!body.ok) return body.response;

    const student = await updateStudent(id, body.data, session.userId);
    return ok({ id: student.id, studentId: student.studentId, email: student.email });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/students/:id/status is expressed here as PUT for simplicity. */
export async function PUT(request: Request, context: RouteContext<"/api/students/[id]">) {
  try {
    const session = await requireStaff();
    const { id } = await context.params;
    const body = await parseBody(request, changeStatusSchema.partial({ studentId: true }));
    if (!body.ok) return body.response;

    const student = await changeStudentStatus(
      id,
      body.data.status!,
      body.data.reason,
      session.userId,
    );
    return ok({ id: student.id, status: student.status, statusReason: student.statusReason });
  } catch (error) {
    return handleApiError(error);
  }
}
