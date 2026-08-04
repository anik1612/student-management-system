import { redirect } from "next/navigation";
import { AppShell, type NavSection } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { summariseAccount } from "@/lib/domain/balance";

export default async function StaffLayout({ children }: LayoutProps<"/staff">) {
  const session = await getSession();
  if (!session) redirect("/login?next=/staff");
  if (session.role !== "STAFF") redirect("/student");

  // Counts shown as pills in the sidebar, so the rail itself says where the work is.
  const [feeRows, unpublished] = await Promise.all([
    prisma.student.findMany({
      select: { fees: { select: { amount: true, dueDate: true, payments: { select: { amount: true } } } } },
    }),
    prisma.grade.count({ where: { published: false } }),
  ]);
  const inArrears = feeRows.filter((s) => summariseAccount(s.fees).isOverdue).length;

  const sections: NavSection[] = [
    {
      heading: "Overview",
      items: [{ href: "/staff", label: "Dashboard", icon: "dashboard" }],
    },
    {
      heading: "Registry",
      items: [
        { href: "/staff/students", label: "Students", icon: "students" },
        { href: "/staff/fees", label: "Fees", icon: "fees", badge: inArrears },
      ],
    },
    {
      heading: "Academic",
      items: [
        { href: "/staff/assessments", label: "Assessments", icon: "assessments", badge: unpublished },
        { href: "/staff/programmes", label: "Programmes", icon: "programmes" },
      ],
    },
  ];

  return (
    <AppShell session={session} sections={sections}>
      {children}
    </AppShell>
  );
}
