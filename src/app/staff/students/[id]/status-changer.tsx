"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { EnrolmentStatus } from "@/generated/prisma/enums";
import { requiresReason, STATUS_LABEL } from "@/lib/domain/status-machine";
import { changeStatusAction } from "../actions";

export function StatusChanger({
  studentId,
  current,
  transitions,
}: {
  studentId: string;
  current: EnrolmentStatus;
  transitions: EnrolmentStatus[];
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<EnrolmentStatus | "">("");
  const [state, formAction, pending] = useActionState(changeStatusAction, undefined);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Status updated");
      setOpen(false);
      setTarget("");
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state]);

  // Terminal statuses offer nothing to change to — say so rather than showing a dead control.
  if (transitions.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        {STATUS_LABEL[current]} is a final status
      </span>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PenLine className="size-3.5" /> Change status
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <input type="hidden" name="studentId" value={studentId} />
          <DialogHeader>
            <DialogTitle>Change enrolment status</DialogTitle>
            <DialogDescription>
              Currently {STATUS_LABEL[current].toLowerCase()}. Withdrawal and completion are final —
              a returning student gets a new enrolment record.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="status">New status</Label>
              <Select
                name="status"
                value={target}
                onValueChange={(v) => setTarget(v as EnrolmentStatus)}
                required
              >
                <SelectTrigger id="status" className="w-full">
                  <SelectValue placeholder="Choose a status" />
                </SelectTrigger>
                <SelectContent>
                  {transitions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABEL[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {target && requiresReason(target) ? (
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (required)</Label>
                <Textarea
                  id="reason"
                  name="reason"
                  required
                  placeholder="e.g. Medical deferral approved to next intake"
                />
                <p className="text-xs text-muted-foreground">
                  Stored on the record and in the audit trail.
                </p>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !target}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Save status
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
