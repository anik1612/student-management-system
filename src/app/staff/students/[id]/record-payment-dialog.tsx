"use client";

import { useActionState, useEffect, useState } from "react";
import { BanknoteArrowUp, Loader2 } from "lucide-react";
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
import { PaymentMethod } from "@/generated/prisma/enums";
import { formatMoney } from "@/lib/money";
import { recordPaymentAction } from "@/app/staff/fees/actions";

export function RecordPaymentDialog({
  feeId,
  studentId,
  outstanding,
  currency,
}: {
  feeId: string;
  studentId: string;
  outstanding: string;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(recordPaymentAction, undefined);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Payment recorded");
      setOpen(false);
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <BanknoteArrowUp className="size-3.5" /> Record a payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <input type="hidden" name="feeAssignmentId" value={feeId} />
          <input type="hidden" name="redirectStudentId" value={studentId} />
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
            <DialogDescription>
              {formatMoney(outstanding, currency)} outstanding on this fee. Payments cannot exceed
              the balance, and each bank reference can only be used once.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`amount-${feeId}`}>Amount ({currency})</Label>
              <Input
                id={`amount-${feeId}`}
                name="amount"
                defaultValue={outstanding}
                inputMode="decimal"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`paidOn-${feeId}`}>Date received</Label>
              <Input
                id={`paidOn-${feeId}`}
                name="paidOn"
                type="date"
                defaultValue={today}
                max={today}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`reference-${feeId}`}>Reference</Label>
              <Input
                id={`reference-${feeId}`}
                name="reference"
                placeholder="BACS-2026-000123"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`method-${feeId}`}>Method</Label>
              <Select name="method" defaultValue={PaymentMethod.BANK_TRANSFER}>
                <SelectTrigger id={`method-${feeId}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(PaymentMethod).map((method) => (
                    <SelectItem key={method} value={method}>
                      {method.replace("_", " ").toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`note-${feeId}`}>Note (optional)</Label>
              <Input id={`note-${feeId}`} name="note" placeholder="Instalment 2 of 2" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
