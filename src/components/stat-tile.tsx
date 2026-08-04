import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { renderIcon, type IconName } from "@/components/nav-icons";
import { Meter } from "@/components/charts";
import { cn } from "@/lib/utils";

/**
 * Stat tile contract: label (sentence case) · value · optional supporting line · optional meter.
 * Values use proportional figures — `tabular-nums` is reserved for columns that align vertically.
 */
export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "default",
  meter,
  href,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  icon: IconName;
  tone?: "default" | "critical" | "good";
  meter?: { value: number; max: number; tone?: "accent" | "good" | "critical" };
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            tone === "critical"
              ? "bg-[color-mix(in_oklab,var(--chart-critical)_14%,transparent)] text-(--chart-critical)"
              : tone === "good"
                ? "bg-[color-mix(in_oklab,var(--chart-good)_14%,transparent)] text-(--chart-good)"
                : "bg-muted text-muted-foreground",
          )}
        >
          {renderIcon(icon, "size-4")}
        </span>
      </div>

      <p
        className={cn(
          "mt-3 text-3xl leading-none font-semibold tracking-tight",
          tone === "critical" && "text-(--chart-critical)",
        )}
      >
        {value}
      </p>

      {meter ? <Meter className="mt-3" value={meter.value} max={meter.max} tone={meter.tone} /> : null}
      {hint ? <p className="mt-2.5 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  );

  const shell =
    "rounded-xl border bg-card p-4 shadow-xs transition-colors sm:p-5";

  if (!href) return <div className={shell}>{body}</div>;

  return (
    <Link href={href} className={cn(shell, "group hover:border-foreground/20")}>
      {body}
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground">
        View <ArrowUpRight className="size-3" />
      </span>
    </Link>
  );
}
