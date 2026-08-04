import { redirect } from "next/navigation";
import { AppShell, type NavSection } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";

export default async function StudentLayout({ children }: LayoutProps<"/student">) {
  const session = await getSession();
  if (!session) redirect("/login?next=/student");
  if (session.role !== "STUDENT") redirect("/staff");

  const sections: NavSection[] = [
    {
      heading: "My record",
      items: [
        { href: "/student", label: "Overview", icon: "dashboard" },
        { href: "/student/fees", label: "Fees", icon: "statement" },
      ],
    },
    {
      heading: "Study",
      items: [
        { href: "/student/assessments", label: "Assessments", icon: "assessments" },
        { href: "/student/results", label: "Results", icon: "results" },
      ],
    },
  ];

  return (
    <AppShell session={session} sections={sections}>
      {children}
    </AppShell>
  );
}
