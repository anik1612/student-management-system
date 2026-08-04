import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Programmes · SMS Registry" };

export default async function ProgrammesPage() {
  const programmes = await prisma.programme.findMany({
    include: {
      modules: { orderBy: { code: "asc" } },
      _count: { select: { students: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader
        title="Programmes"
        description="Standard fee rates and modules. The rate here seeds new fee lines; existing bills are never rewritten."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {programmes.map((programme) => (
          <Card key={programme.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{programme.name}</CardTitle>
                  <CardDescription>
                    {programme.code} · {programme.level} · {programme.durationYears} year
                    {programme.durationYears === 1 ? "" : "s"}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {formatMoney(programme.defaultFeeAmount, programme.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">standard annual fee</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {programme._count.students} student{programme._count.students === 1 ? "" : "s"} on
                the register
              </p>
              <div className="flex flex-wrap gap-2">
                {programme.modules.map((module) => (
                  <Badge key={module.id} variant="secondary" className="font-normal">
                    {module.code} — {module.title} ({module.credits} cr)
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
