import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { CreateAssessmentForm } from "./create-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create an assessment · SMS Registry" };

export default async function NewAssessmentPage() {
  const modules = await prisma.module.findMany({
    include: { programme: { select: { code: true, name: true } } },
    orderBy: { code: "asc" },
  });

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/staff/assessments">
          <ArrowLeft className="size-4" /> Assessments
        </Link>
      </Button>

      <PageHeader
        title="Create an assessment"
        description="Only students on the module's programme can submit against it."
      />

      <CreateAssessmentForm
        modules={modules.map((m) => ({
          id: m.id,
          code: m.code,
          title: m.title,
          programme: m.programme.code,
        }))}
      />
    </>
  );
}
