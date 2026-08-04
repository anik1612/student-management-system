import Link from "next/link";
import { GraduationCap, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/login/actions";
import type { SessionUser } from "@/lib/auth/session";
import { SidebarLink } from "@/components/nav-link";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Count shown as a pill — the number of things waiting on this section. */
  badge?: number;
}

export interface NavSection {
  heading: string;
  items: NavItem[];
}

export function AppShell({
  session,
  sections,
  children,
}: {
  session: SessionUser;
  sections: NavSection[];
  children: React.ReactNode;
}) {
  const initials = session.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      {/* Sidebar — the persistent frame that makes this read as a back office
          rather than a website. Collapses to a horizontal rail on small screens. */}
      <aside className="sticky top-0 z-30 flex h-auto flex-col border-b bg-sidebar text-sidebar-foreground lg:h-screen lg:border-r lg:border-b-0">
        <div className="flex h-14 shrink-0 items-center gap-2.5 px-4 lg:h-16 lg:px-5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-4.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm leading-tight font-semibold">SMS Registry</p>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">
              {session.role === "STAFF" ? "Back office" : "Student portal"}
            </p>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:gap-0 lg:overflow-y-auto lg:pb-4">
          {sections.map((section) => (
            <div key={section.heading} className="contents lg:mb-5 lg:block">
              <p className="hidden px-2 pb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase lg:block">
                {section.heading}
              </p>
              <div className="flex gap-1 lg:flex-col lg:gap-0.5">
                {section.items.map((item) => (
                  <SidebarLink
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    badge={item.badge}
                  >
                    {item.label}
                  </SidebarLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User block pinned to the bottom of the rail. */}
        <div className="hidden items-center gap-2.5 border-t p-3 lg:flex">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs leading-tight font-medium">{session.name}</p>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">
              {session.email}
            </p>
          </div>
          <form action={logout}>
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Mobile-only account bar; on desktop the sidebar carries this. */}
        <div className="flex items-center justify-between border-b px-4 py-2 lg:hidden">
          <span className="text-xs text-muted-foreground">{session.name}</span>
          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut className="size-4" /> Sign out
            </Button>
          </form>
        </div>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[85rem]">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}
