import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { academicYearForDate, academicYearOptions } from "@/lib/domain/student-id";
import { serialiseMoney } from "@/lib/money";
import { EnrolStudentForm } from "./enrol-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Enrol a student · SMS Registry" };

export default async function NewStudentPage() {
  const programmes = await prisma.programme.findMany({ orderBy: { name: "asc" } });

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/staff/students">
          <ArrowLeft className="size-4" /> Student register
        </Link>
      </Button>

      <PageHeader
        title="Enrol a student"
        description="The registry ID is allocated automatically from the intake year of the session you choose."
      />

      <EnrolStudentForm
        programmes={programmes.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          currency: p.currency,
          defaultFeeAmount: serialiseMoney(p.defaultFeeAmount),
        }))}
        academicYears={academicYearOptions()}
        currentAcademicYear={academicYearForDate()}
      />
    </>
  );
}
