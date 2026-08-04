"use client";

import { useActionState, useEffect, useState } from "react";
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
import { EnrolmentStatus } from "@/generated/prisma/enums";
import { STATUS_LABEL } from "@/lib/domain/status-machine";
import { formatMoney } from "@/lib/money";
import { createStudentAction } from "../actions";

interface ProgrammeOption {
  id: string;
  code: string;
  name: string;
  currency: string;
  defaultFeeAmount: string;
}

export function EnrolStudentForm({
  programmes,
  academicYears,
  currentAcademicYear,
}: {
  programmes: ProgrammeOption[];
  academicYears: string[];
  currentAcademicYear: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createStudentAction, undefined);
  const [programmeId, setProgrammeId] = useState(programmes[0]?.id ?? "");
  const [createFee, setCreateFee] = useState(true);

  const programme = programmes.find((p) => p.id === programmeId);

  useEffect(() => {
    if (state?.ok) {
      toast.success(`Enrolled — registry ID ${state.data.studentId}`);
      router.push(`/staff/students/${state.data.id}`);
    }
  }, [state, router]);

  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Student details</CardTitle>
            <CardDescription>Personal information held on the register.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" name="firstName" errors={errors.firstName} required />
            <Field label="Last name" name="lastName" errors={errors.lastName} required />
            <Field
              label="Email address"
              name="email"
              type="email"
              errors={errors.email}
              required
              hint="Must be unique across the register."
              className="sm:col-span-2"
            />
            <Field
              label="Date of birth"
              name="dateOfBirth"
              type="date"
              errors={errors.dateOfBirth}
              required
              hint="Students must be at least 15 years old."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Programme and session</CardTitle>
            <CardDescription>
              The registry ID takes its year from the session — 2026/27 produces SMS-2026-…
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="programmeId">Programme</Label>
              <Select name="programmeId" value={programmeId} onValueChange={setProgrammeId} required>
                <SelectTrigger id="programmeId" className="w-full">
                  <SelectValue placeholder="Choose a programme" />
                </SelectTrigger>
                <SelectContent>
                  {programmes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={errors.programmeId} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="academicYear">Academic session</Label>
              <Select name="academicYear" defaultValue={currentAcademicYear} required>
                <SelectTrigger id="academicYear" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={errors.academicYear} />
            </div>

            <Field
              label="Year of study"
              name="yearOfStudy"
              type="number"
              defaultValue="1"
              min={1}
              max={7}
              errors={errors.yearOfStudy}
              required
            />

            <div className="space-y-2">
              <Label htmlFor="status">Enrolment status</Label>
              <Select name="status" defaultValue={EnrolmentStatus.ENROLLED}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[EnrolmentStatus.ENROLLED, EnrolmentStatus.DEFERRED].map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABEL[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                New records start active. Withdrawal and completion are recorded later, with a reason.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tuition fee</CardTitle>
            <CardDescription>
              Billed from the programme rate. The amount is copied onto the fee line, so a later
              price change will not rewrite this student&apos;s balance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="createFee"
                value="true"
                checked={createFee}
                onChange={(e) => setCreateFee(e.target.checked)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                Raise the tuition fee now
                {programme ? (
                  <span className="block text-muted-foreground">
                    {formatMoney(programme.defaultFeeAmount, programme.currency)} for {programme.code}
                  </span>
                ) : null}
              </span>
            </label>

            {createFee ? (
              <Field
                label="Fee due date"
                name="feeDueDate"
                type="date"
                errors={errors.feeDueDate}
                required
              />
            ) : null}
          </CardContent>
        </Card>

        {state && !state.ok ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Enrol student
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  errors,
  hint,
  className,
  ...props
}: {
  label: string;
  name: string;
  errors?: string[];
  hint?: string;
  className?: string;
} & React.ComponentProps<typeof Input>) {
  return (
    <div className={className ? `space-y-2 ${className}` : "space-y-2"}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} aria-invalid={errors ? true : undefined} {...props} />
      {hint && !errors ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <FieldError errors={errors} />
    </div>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-xs font-medium text-destructive">{errors[0]}</p>;
}
