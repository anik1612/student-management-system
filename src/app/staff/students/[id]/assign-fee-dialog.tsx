"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FeeType } from "@/generated/prisma/enums";
import { formatMoney } from "@/lib/money";
import { assignFeeAction } from "@/app/staff/fees/actions";

export function AssignFeeDialog({
  studentId,
  academicYear,
  programme,
  disabled,
  disabledReason,
}: {
  studentId: string;
  academicYear: string;
  programme: { code: string; defaultFeeAmount: string; currency: string };
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(assignFeeAction, undefined);
  const [amount, setAmount] = useState(programme.defaultFeeAmount);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Fee raised");
      setOpen(false);
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state]);

  if (disabled) {
    return (
      <span className="text-xs text-muted-foreground" title={disabledReason}>
        {disabledReason}
      </span>
    );
  }

  const isOverride = amount !== programme.defaultFeeAmount;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-3.5" /> Raise a fee
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <input type="hidden" name="studentId" value={studentId} />
          <DialogHeader>
            <DialogTitle>Raise a fee</DialogTitle>
            <DialogDescription>
              Defaults to the {programme.code} rate of{" "}
              {formatMoney(programme.defaultFeeAmount, programme.currency)}. Only one fee of each
              type per session.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="type">Fee type</Label>
              <Select name="type" defaultValue={FeeType.TUITION}>
                <SelectTrigger id="type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(FeeType).map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace("_", " ").toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount ({programme.currency})</Label>
              <Input
                id="amount"
                name="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="academicYear">Session</Label>
              <Input id="academicYear" name="academicYear" defaultValue={academicYear} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due date</Label>
              <Input id="dueDate" name="dueDate" type="date" required />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                name="description"
                placeholder="Annual tuition fee"
                defaultValue="Annual tuition fee"
              />
            </div>

            {isOverride ? (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="overrideNote">Why does this differ from the standard rate?</Label>
                <Input
                  id="overrideNote"
                  name="overrideNote"
                  placeholder="e.g. Bursary applied — approved by Head of Registry"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Recorded against the fee and in the audit log.
                </p>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Raise fee
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
