import { requireSession } from "@/lib/auth/session";
import { handleApiError, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { serialiseMoney } from "@/lib/money";

/** GET /api/programmes — programmes with their modules and standard fee. */
export async function GET() {
  try {
    await requireSession();
    const programmes = await prisma.programme.findMany({
      include: { modules: { orderBy: { code: "asc" } }, _count: { select: { students: true } } },
      orderBy: { name: "asc" },
    });

    return ok(
      programmes.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        level: p.level,
        durationYears: p.durationYears,
        defaultFeeAmount: serialiseMoney(p.defaultFeeAmount),
        currency: p.currency,
        studentCount: p._count.students,
        modules: p.modules.map((m) => ({ id: m.id, code: m.code, title: m.title, credits: m.credits })),
      })),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
