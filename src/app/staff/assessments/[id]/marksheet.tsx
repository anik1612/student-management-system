"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Download, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Classification } from "@/generated/prisma/enums";
import { ClassificationBadge, LateBadge, WithheldBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import { enterGradeAction, setGradePublishedAction } from "../actions";

export interface MarksheetRow {
  studentKey: string;
  studentId: string;
  name: string;
  submission: {
    id: string;
    fileId: string | null;
    fileName: string;
    submittedAt: string;
    isLate: boolean;
    lateness: string;
    version: number;
  } | null;
  grade: {
    id: string;
    score: number | null;
    isAbsent: boolean;
    classification: Classification | null;
    feedback: string | null;
    published: boolean;
    withheldReason: string | null;
  } | null;
  inArrears: boolean;
  overdueAmount: string;
}

export function Marksheet({ assessmentId, rows }: { assessmentId: string; rows: MarksheetRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Student</TableHead>
          <TableHead>Submission</TableHead>
          <TableHead className="w-40">Mark</TableHead>
          <TableHead>Classification</TableHead>
          <TableHead className="text-right">Result visibility</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <MarksheetRowView key={row.studentKey} assessmentId={assessmentId} row={row} />
        ))}
      </TableBody>
    </Table>
  );
}

function MarksheetRowView({ assessmentId, row }: { assessmentId: string; row: MarksheetRow }) {
  const [score, setScore] = useState(row.grade?.score?.toString() ?? "");
  const [saving, startSaving] = useTransition();
  const [publishing, startPublishing] = useTransition();

  useEffect(() => {
    setScore(row.grade?.score?.toString() ?? "");
  }, [row.grade?.score]);

  function saveGrade(isAbsent: boolean) {
    const formData = new FormData();
    formData.set("assessmentId", assessmentId);
    formData.set("studentId", row.studentKey);
    formData.set("score", isAbsent ? "" : score);
    formData.set("isAbsent", String(isAbsent));

    startSaving(async () => {
      const result = await enterGradeAction(undefined, formData);
      if (result.ok) toast.success(`Mark saved for ${row.name}`);
      else toast.error(result.error);
    });
  }

  function setPublished(publish: boolean, overrideArrearsHold = false) {
    if (!row.grade) return;
    const formData = new FormData();
    formData.set("gradeId", row.grade.id);
    formData.set("assessmentId", assessmentId);
    formData.set("publish", String(publish));
    formData.set("overrideArrearsHold", String(overrideArrearsHold));
    if (!publish) formData.set("withheldReason", "Withheld by Registry");

    startPublishing(async () => {
      const result = await setGradePublishedAction(undefined, formData);
      if (result.ok) {
        toast.success(publish ? `Result released to ${row.name}` : "Result withheld", {
          description: result.data.warning,
        });
      } else if (result.code === "RULE_VIOLATION" && publish) {
        // The arrears hold is a guard rail, not a wall — offer the override in place.
        toast.error(result.error, {
          action: {
            label: "Publish anyway",
            onClick: () => setPublished(true, true),
          },
          duration: 10_000,
        });
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <TableRow>
      <TableCell>
        <Link href={`/staff/students/${row.studentKey}`} className="font-medium hover:underline">
          {row.name}
        </Link>
        <div className="text-xs text-muted-foreground">{row.studentId}</div>
        {row.inArrears ? (
          <Badge
            variant="outline"
            className="mt-1 border-rose-600/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
          >
            <AlertTriangle className="size-3" />
            {formatMoney(row.overdueAmount)} overdue
          </Badge>
        ) : null}
      </TableCell>

      <TableCell>
        {row.submission ? (
          <div className="space-y-1">
            {row.submission.fileId ? (
              <Button asChild variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent">
                <a href={`/api/files/${row.submission.fileId}`} className="inline-flex items-center gap-1">
                  <Download className="size-3.5" />
                  <span className="max-w-40 truncate">{row.submission.fileName}</span>
                </a>
              </Button>
            ) : null}
            {row.submission.isLate ? (
              <LateBadge label={row.submission.lateness} />
            ) : (
              <div className="text-xs text-muted-foreground">On time</div>
            )}
            {row.submission.version > 1 ? (
              <div className="text-xs text-muted-foreground">v{row.submission.version}</div>
            ) : null}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">No submission</span>
        )}
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-1">
          <Input
            value={row.grade?.isAbsent ? "" : score}
            onChange={(e) => setScore(e.target.value)}
            onBlur={() => {
              const unchanged = score === (row.grade?.score?.toString() ?? "");
              if (!unchanged && score !== "") saveGrade(false);
            }}
            inputMode="numeric"
            placeholder={row.grade?.isAbsent ? "Absent" : "0–100"}
            className="h-8 w-20"
            aria-label={`Mark for ${row.name}`}
            disabled={saving}
          />
          {saving ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1 h-auto p-0 text-xs text-muted-foreground hover:bg-transparent"
          onClick={() => saveGrade(!row.grade?.isAbsent)}
          disabled={saving}
        >
          {row.grade?.isAbsent ? "Clear absence" : "Mark absent"}
        </Button>
      </TableCell>

      <TableCell>
        {row.grade?.isAbsent ? (
          <Badge variant="outline">Absent</Badge>
        ) : (
          <ClassificationBadge value={row.grade?.classification ?? null} />
        )}
      </TableCell>

      <TableCell className="text-right">
        {!row.grade ? (
          <span className="text-sm text-muted-foreground">Not marked</span>
        ) : row.grade.published ? (
          <div className="flex items-center justify-end gap-2">
            <span className="inline-flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-400">
              <Check className="size-3.5" /> Published
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPublished(false)}
              disabled={publishing}
            >
              <EyeOff className="size-3.5" /> Withhold
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <WithheldBadge reason={row.grade.withheldReason} />
              <Button size="sm" onClick={() => setPublished(true)} disabled={publishing}>
                {publishing ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
                Publish
              </Button>
            </div>
            {row.grade.withheldReason ? (
              <span className="text-xs text-muted-foreground">{row.grade.withheldReason}</span>
            ) : null}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
