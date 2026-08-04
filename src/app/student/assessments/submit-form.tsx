"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACCEPT_ATTRIBUTE } from "@/lib/domain/submission-rules";
import { submitWorkAction } from "./actions";

export function SubmitWorkForm({
  assessmentId,
  isReplacement,
  dueAt,
}: {
  assessmentId: string;
  isReplacement: boolean;
  dueAt: string;
}) {
  const [state, formAction, pending] = useActionState(submitWorkAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      if (state.data.isLate) {
        toast.warning("Submitted — recorded as late", {
          description: "Your work was accepted but is flagged late for the marker.",
        });
      } else {
        toast.success(
          state.data.version > 1
            ? `Replaced — this is version ${state.data.version}`
            : "Submitted on time",
        );
      }
    }
  }, [state]);

  const pastDeadline = new Date(dueAt).getTime() < Date.now();

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="assessmentId" value={assessmentId} />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="file"
          name="file"
          accept={ACCEPT_ATTRIBUTE}
          required
          className="max-w-xs"
          aria-label="Choose a PDF or DOCX file"
        />
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {isReplacement ? "Replace submission" : "Submit work"}
        </Button>
      </div>

      {isReplacement ? (
        <p className="text-xs text-muted-foreground">
          Replacing keeps your earlier version on file for Registry.
        </p>
      ) : pastDeadline ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          The deadline has passed — your submission will be accepted but flagged as late.
        </p>
      ) : null}

      {state && !state.ok ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
