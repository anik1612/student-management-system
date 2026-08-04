"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Small inline-SVG/CSS chart set. No charting library: these three forms are simple enough
 * that hand-built marks are smaller than a dependency and let us hold the house specs exactly —
 * ≤24px bars, 4px rounded data-ends squared at the baseline, 2px surface gaps between fills,
 * hairline solid axes, values direct-labelled so nothing is gated behind a tooltip.
 */

const SURFACE = "var(--card)";

// ---------------------------------------------------------------------------
// Part-to-whole: fee position
// ---------------------------------------------------------------------------

export interface Segment {
  key: string;
  label: string;
  value: number;
  /** Semantic state, not an identity colour — see the legend note below. */
  tone: "good" | "neutral" | "critical";
  display: string;
}

const TONE_FILL: Record<Segment["tone"], string> = {
  // Status tokens: these segments mean *states* (settled / on schedule / overdue), so they
  // carry the reserved status colours rather than a categorical palette, and every one ships
  // with a text label beside it so colour is never the only channel.
  good: "var(--chart-good)",
  neutral: "var(--chart-neutral)",
  critical: "var(--chart-critical)",
};

export function StackedShareBar({
  segments,
  height = 14,
}: {
  segments: Segment[];
  height?: number;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const visible = segments.filter((s) => s.value > 0);

  if (total <= 0) {
    return (
      <div
        className="rounded-full bg-muted"
        style={{ height }}
        role="img"
        aria-label="Nothing billed yet"
      />
    );
  }

  return (
    <div>
      <div
        className="flex w-full overflow-hidden rounded-full"
        style={{ height, gap: 2 }} // 2px surface gap between fills
        role="img"
        aria-label={visible.map((s) => `${s.label} ${s.display}`).join(", ")}
      >
        {visible.map((segment) => (
          <div
            key={segment.key}
            className="h-full rounded-full transition-opacity first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(segment.value / total) * 100}%`,
              background: TONE_FILL[segment.tone],
              opacity: hovered && hovered !== segment.key ? 0.45 : 1,
            }}
            onMouseEnter={() => setHovered(segment.key)}
            onMouseLeave={() => setHovered(null)}
            title={`${segment.label}: ${segment.display}`}
          />
        ))}
      </div>

      {/* Legend doubles as the value table — every figure is readable without hovering. */}
      <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-3">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className="flex items-start gap-2"
            onMouseEnter={() => setHovered(segment.key)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className="mt-1 size-2.5 shrink-0 rounded-full"
              style={{ background: TONE_FILL[segment.tone] }}
              aria-hidden
            />
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">{segment.label}</dt>
              <dd className="text-sm font-semibold tabular-nums">{segment.display}</dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Magnitude: horizontal bars
// ---------------------------------------------------------------------------

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  display?: string;
  /** Optional explicit fill — used by the ordinal (age band) ramp. */
  fill?: string;
  href?: string;
}

export function HorizontalBars({
  data,
  emptyMessage = "Nothing to show",
  barHeight = 22,
  labelWidth = "7rem",
  // Sized to the widest rendered value — currency needs far more room than a count, and a
  // fixed column silently clips "£10,500.00".
  valueWidth = "3rem",
}: {
  data: BarDatum[];
  emptyMessage?: string;
  barHeight?: number;
  labelWidth?: string;
  valueWidth?: string;
}) {
  const id = useId();
  const max = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2.5">
      {data.map((datum) => {
        const pct = (datum.value / max) * 100;
        const row = (
          <>
            <span
              className="shrink-0 truncate text-xs text-muted-foreground"
              style={{ width: labelWidth }}
            >
              {datum.label}
            </span>
            <span className="relative flex-1" style={{ height: barHeight }}>
              {/* Track is the recessive surface; the bar grows from a single baseline. */}
              <span className="absolute inset-y-0 left-0 w-full rounded-lg bg-muted/60" />
              <span
                className="absolute inset-y-0 left-0 rounded-r-lg transition-[width]"
                style={{
                  width: `${Math.max(pct, datum.value > 0 ? 2 : 0)}%`,
                  background: datum.fill ?? "var(--chart-1)",
                }}
              />
            </span>
            <span
              className="shrink-0 text-right text-xs font-semibold whitespace-nowrap tabular-nums"
              style={{ width: valueWidth }}
            >
              {datum.display ?? datum.value.toLocaleString("en-GB")}
            </span>
          </>
        );

        return datum.href ? (
          <a
            key={`${id}-${datum.key}`}
            href={datum.href}
            className="flex items-center gap-3 rounded-md transition-opacity hover:opacity-80"
          >
            {row}
          </a>
        ) : (
          <div key={`${id}-${datum.key}`} className="flex items-center gap-3">
            {row}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ratio against a limit: meter
// ---------------------------------------------------------------------------

export function Meter({
  value,
  max,
  tone = "accent",
  className,
}: {
  value: number;
  max: number;
  tone?: "accent" | "good" | "critical";
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fill =
    tone === "good" ? "var(--chart-good)" : tone === "critical" ? "var(--chart-critical)" : "var(--chart-1)";

  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: fill }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trend: sparkline (2px line, ≥8px end marker with a 2px surface ring)
// ---------------------------------------------------------------------------

export function Sparkline({
  points,
  width = 120,
  height = 32,
}: {
  points: number[];
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;

  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const stepX = width / (points.length - 1);
  const pad = 4;

  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = pad + (height - pad * 2) * (1 - (p - min) / span);
    return [x, y] as const;
  });

  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = coords[coords.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <path d={path} fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={4} fill="var(--chart-1)" stroke={SURFACE} strokeWidth={2} />
    </svg>
  );
}
