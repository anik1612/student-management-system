import { requireStaff } from "@/lib/auth/session";
import { handleApiError, ok, parseBody } from "@/lib/api";
import { createStudentSchema, studentFilterSchema } from "@/lib/validation/schemas";
import { createStudent, listStudents } from "@/lib/services/students";

/** GET /api/students?q=&programmeId=&status=&arrears=&page=&sort= */
export async function GET(request: Request) {
  try {
    await requireStaff();
    const url = new URL(request.url);
    const filter = studentFilterSchema.parse({
      q: url.searchParams.get("q") ?? undefined,
      programmeId: url.searchParams.get("programmeId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      arrears: url.searchParams.get("arrears") ?? undefined,
      page: url.searchParams.get("page") ?? 1,
      sort: url.searchParams.get("sort") ?? "name",
    });

    return ok(await listStudents(filter));
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/students — enrols a student and allocates the next registry ID. */
export async function POST(request: Request) {
  try {
    const session = await requireStaff();
    const body = await parseBody(request, createStudentSchema);
    if (!body.ok) return body.response;

    const student = await createStudent(body.data, session.userId);
    return ok(
      {
        id: student.id,
        studentId: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        status: student.status,
        academicYear: student.academicYear,
      },
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
