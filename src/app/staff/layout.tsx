import { redirect } from "next/navigation";
import { AppShell, type NavItem } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";

const NAV: NavItem[] = [
  { href: "/staff", label: "Dashboard" },
  { href: "/staff/students", label: "Students" },
  { href: "/staff/fees", label: "Fees" },
  { href: "/staff/assessments", label: "Assessments" },
  { href: "/staff/programmes", label: "Programmes" },
];

export default async function StaffLayout({ children }: LayoutProps<"/staff">) {
  const session = await getSession();
  if (!session) redirect("/login?next=/staff");
  if (session.role !== "STAFF") redirect("/student");

  return (
    <AppShell session={session} nav={NAV}>
      {children}
    </AppShell>
  );
}
