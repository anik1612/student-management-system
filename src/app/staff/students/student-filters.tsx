"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EnrolmentStatus } from "@/generated/prisma/enums";
import { STATUS_LABEL } from "@/lib/domain/status-machine";

const ALL = "__all__";

export function StudentFilters({
  programmes,
}: {
  programmes: Array<{ id: string; code: string; name: string }>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function apply(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value || value === ALL) next.delete(key);
      else next.set(key, value);
    }
    // Any filter change resets to the first page — otherwise page 3 of a 1-page result is empty.
    next.delete("page");
    startTransition(() => router.push(`/staff/students?${next.toString()}`));
  }

  const hasFilters = ["q", "programmeId", "status", "arrears"].some((k) => params.get(k));

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const input = new FormData(event.currentTarget).get("q");
        apply({ q: String(input ?? "") });
      }}
    >
      <div className="relative min-w-56 flex-1">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={params.get("q") ?? ""}
          placeholder="Name, registry ID or email…"
          className="pl-9"
          aria-label="Search students"
        />
      </div>

      <Select
        defaultValue={params.get("programmeId") ?? ALL}
        onValueChange={(value) => apply({ programmeId: value })}
      >
        <SelectTrigger className="w-48" aria-label="Filter by programme">
          <SelectValue placeholder="All programmes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All programmes</SelectItem>
          {programmes.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.code} — {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        defaultValue={params.get("status") ?? ALL}
        onValueChange={(value) => apply({ status: value })}
      >
        <SelectTrigger className="w-40" aria-label="Filter by status">
          <SelectValue placeholder="Any status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any status</SelectItem>
          {Object.values(EnrolmentStatus).map((status) => (
            <SelectItem key={status} value={status}>
              {STATUS_LABEL[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        defaultValue={params.get("arrears") ?? ALL}
        onValueChange={(value) => apply({ arrears: value })}
      >
        <SelectTrigger className="w-44" aria-label="Filter by fee state">
          <SelectValue placeholder="Any fee state" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any fee state</SelectItem>
          <SelectItem value="overdue">Overdue only</SelectItem>
          <SelectItem value="outstanding">Any balance owing</SelectItem>
        </SelectContent>
      </Select>

      <Button type="submit" variant="secondary" disabled={pending}>
        Search
      </Button>

      {hasFilters ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => startTransition(() => router.push("/staff/students"))}
        >
          <X className="size-4" /> Clear
        </Button>
      ) : null}
    </form>
  );
}
