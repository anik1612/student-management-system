import { AlertTriangle, Clock, EyeOff } from "lucide-react";
import type { Classification, EnrolmentStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FeeState } from "@/lib/domain/balance";
import { STATUS_LABEL } from "@/lib/domain/status-machine";
import { classificationLabel } from "@/lib/domain/classification";

const STATUS_STYLES: Record<EnrolmentStatus, string> = {
  ENROLLED: "border-emerald-600/25 bg-emerald-500/12 text-emerald-800 dark:text-emerald-300",
  DEFERRED: "border-amber-600/25 bg-amber-500/12 text-amber-800 dark:text-amber-300",
  WITHDRAWN: "border-rose-600/25 bg-rose-500/12 text-rose-800 dark:text-rose-300",
  COMPLETED: "border-sky-600/25 bg-sky-500/12 text-sky-800 dark:text-sky-300",
};

export function StatusBadge({ status }: { status: EnrolmentStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_STYLES[status])}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

const FEE_STYLES: Record<FeeState, string> = {
  PAID: "border-emerald-600/25 bg-emerald-500/12 text-emerald-800 dark:text-emerald-300",
  PART_PAID: "border-sky-600/25 bg-sky-500/12 text-sky-800 dark:text-sky-300",
  DUE: "border-muted-foreground/25 bg-muted text-muted-foreground",
  OVERDUE: "border-rose-600/30 bg-rose-500/15 text-rose-800 dark:text-rose-300",
};

const FEE_LABELS: Record<FeeState, string> = {
  PAID: "Paid",
  PART_PAID: "Part paid",
  DUE: "Due",
  OVERDUE: "Overdue",
};

export function FeeStateBadge({ state, daysOverdue }: { state: FeeState; daysOverdue?: number }) {
  return (
    <Badge variant="outline" className={cn("font-medium", FEE_STYLES[state])}>
      {state === "OVERDUE" ? <AlertTriangle className="size-3" /> : null}
      {FEE_LABELS[state]}
      {state === "OVERDUE" && daysOverdue ? ` · ${daysOverdue}d` : ""}
    </Badge>
  );
}

const CLASSIFICATION_STYLES: Record<Classification, string> = {
  DISTINCTION: "border-violet-600/25 bg-violet-500/12 text-violet-800 dark:text-violet-300",
  MERIT: "border-sky-600/25 bg-sky-500/12 text-sky-800 dark:text-sky-300",
  PASS: "border-emerald-600/25 bg-emerald-500/12 text-emerald-800 dark:text-emerald-300",
  FAIL: "border-rose-600/25 bg-rose-500/12 text-rose-800 dark:text-rose-300",
};

export function ClassificationBadge({ value }: { value: Classification | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant="outline" className={cn("font-medium", CLASSIFICATION_STYLES[value])}>
      {classificationLabel(value)}
    </Badge>
  );
}

export function LateBadge({ label }: { label: string }) {
  return (
    <Badge
      variant="outline"
      className="border-amber-600/30 bg-amber-500/15 font-medium text-amber-800 dark:text-amber-300"
    >
      <Clock className="size-3" />
      {label}
    </Badge>
  );
}

export function WithheldBadge({ reason }: { reason?: string | null }) {
  return (
    <Badge
      variant="outline"
      className="border-muted-foreground/25 bg-muted font-medium text-muted-foreground"
      title={reason ?? undefined}
    >
      <EyeOff className="size-3" />
      Withheld
    </Badge>
  );
}
