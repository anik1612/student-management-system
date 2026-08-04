"use client";

import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
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
import { publishAssessmentAction } from "../actions";

export function PublishAllButton({
  assessmentId,
  unpublished,
  arrearsHolds,
}: {
  assessmentId: string;
  unpublished: number;
  arrearsHolds: number;
}) {
  const [open, setOpen] = useState(false);
  const [override, setOverride] = useState(false);
  const [pending, start] = useTransition();

  if (unpublished === 0) {
    return <span className="text-sm text-muted-foreground">All marks released</span>;
  }

  function publish() {
    const formData = new FormData();
    formData.set("assessmentId", assessmentId);
    formData.set("overrideArrearsHold", String(override));

    start(async () => {
      const result = await publishAssessmentAction(undefined, formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      const held = result.data.heldBack;
      toast.success(`${result.data.published} result${result.data.published === 1 ? "" : "s"} released`, {
        description: held.length
          ? `Held back: ${held.map((h) => `${h.name} (${h.reason})`).join(", ")}`
          : undefined,
        duration: held.length ? 10_000 : 4_000,
      });
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Send className="size-4" /> Publish {unpublished} result{unpublished === 1 ? "" : "s"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Release results to students</DialogTitle>
          <DialogDescription>
            {unpublished} marked result{unpublished === 1 ? "" : "s"} will become visible on the
            students&apos; own marksheets. Unmarked students are skipped.
          </DialogDescription>
        </DialogHeader>

        {arrearsHolds > 0 ? (
          <div className="space-y-3 rounded-lg border border-rose-600/30 bg-rose-500/5 p-4 text-sm">
            <p className="font-medium text-rose-800 dark:text-rose-300">
              {arrearsHolds} student{arrearsHolds === 1 ? " is" : "s are"} in fee arrears
            </p>
            <p className="text-muted-foreground">
              Their results stay withheld and are marked &ldquo;pending fee settlement&rdquo; unless
              you override the hold. Overrides are recorded in the audit log.
            </p>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={override}
                onChange={(e) => setOverride(e.target.checked)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>Release results for students in arrears too</span>
            </label>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={publish} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Publish results
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
