"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type IconName, renderIcon } from "@/components/nav-icons";
import { cn } from "@/lib/utils";

export function SidebarLink({
  href,
  icon,
  badge,
  children,
}: {
  href: string;
  icon: string;
  badge?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Section roots match exactly; their child pages match by prefix, so /staff/students/new
  // still highlights "Students" without /staff highlighting everything.
  const isRoot = href === "/staff" || href === "/student";
  const active = isRoot ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
      )}
    >
      {renderIcon(icon as IconName, cn("size-4 shrink-0", active ? "opacity-100" : "opacity-70"))}
      <span className="flex-1">{children}</span>
      {badge && badge > 0 ? (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold tabular-nums",
            active ? "bg-background text-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}
