import {
  BanknoteArrowUp,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Layers,
  Receipt,
  Users,
} from "lucide-react";

/**
 * Server Components can only hand plain values to Client Components, so navigation passes an
 * icon *name* and the client resolves it here.
 */
const ICONS = {
  dashboard: LayoutDashboard,
  students: Users,
  fees: BanknoteArrowUp,
  assessments: ClipboardList,
  programmes: Layers,
  results: GraduationCap,
  statement: Receipt,
  submissions: FileText,
} as const;

export type IconName = keyof typeof ICONS;

export function renderIcon(name: IconName, className?: string) {
  const Icon = ICONS[name] ?? LayoutDashboard;
  return <Icon className={className} aria-hidden />;
}
