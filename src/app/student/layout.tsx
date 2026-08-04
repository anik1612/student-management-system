import { redirect } from "next/navigation";
import { AppShell, type NavItem } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";

const NAV: NavItem[] = [
  { href: "/student", label: "Overview" },
  { href: "/student/fees", label: "Fees" },
  { href: "/student/assessments", label: "Assessments" },
  { href: "/student/results", label: "Results" },
];

export default async function StudentLayout({ children }: LayoutProps<"/student">) {
  const session = await getSession();
  if (!session) redirect("/login?next=/student");
  if (session.role !== "STUDENT") redirect("/staff");

  return (
    <AppShell session={session} nav={NAV}>
      {children}
    </AppShell>
  );
}
