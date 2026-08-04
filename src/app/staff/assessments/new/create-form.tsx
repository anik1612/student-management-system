"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createAssessmentAction } from "../actions";

export function CreateAssessmentForm({
  modules,
}: {
  modules: Array<{ id: string; code: string; title: string; programme: string }>;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createAssessmentAction, undefined);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Assessment created");
      router.push(`/staff/assessments/${state.data.id}`);
    }
  }, [state, router]);

  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assessment details</CardTitle>
          <CardDescription>
            The deadline must be in the future — otherwise every submission would arrive late.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" placeholder="Coursework 1: Relational Design" required />
            {errors.title ? (
              <p className="text-xs font-medium text-destructive">{errors.title[0]}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="moduleId">Module</Label>
            <Select name="moduleId" defaultValue={modules[0]?.id} required>
              <SelectTrigger id="moduleId" className="w-full">
                <SelectValue placeholder="Choose a module" />
              </SelectTrigger>
              <SelectContent>
                {modules.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.code} — {m.title} ({m.programme})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.moduleId ? (
              <p className="text-xs font-medium text-destructive">{errors.moduleId[0]}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueAt">Submission deadline</Label>
            <Input id="dueAt" name="dueAt" type="datetime-local" required />
            {errors.dueAt ? (
              <p className="text-xs font-medium text-destructive">{errors.dueAt[0]}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="weighting">Weighting (% of the module)</Label>
            <Input
              id="weighting"
              name="weighting"
              type="number"
              min={1}
              max={100}
              defaultValue={100}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Brief (optional)</Label>
            <Textarea id="description" name="description" rows={3} />
          </div>

          {state && !state.ok ? (
            <div className="sm:col-span-2">
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            </div>
          ) : null}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Create assessment
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
