import { z } from "zod";
import {
  EnrolmentStatus,
  FeeType,
  PaymentMethod,
} from "@/generated/prisma/enums";
import { MAX_SCORE, MIN_SCORE } from "@/lib/domain/classification";

/** One set of schemas, used by the forms, the server actions and the REST handlers. */

const trimmed = (max: number) => z.string().trim().min(1).max(max);

export const MIN_AGE = 15;
export const MAX_AGE = 100;

const dateFromInput = z
  .union([z.string(), z.date()])
  .transform((value, ctx) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date" });
      return z.NEVER;
    }
    return date;
  });

const money = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const text = String(value).trim().replace(/,/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(text)) {
      ctx.addIssue({ code: "custom", message: "Enter an amount like 9250.00" });
      return z.NEVER;
    }
    return text;
  });

export const academicYearSchema = z
  .string()
  .trim()
  .regex(/^\d{4}\/\d{2}$/, "Use the session format 2025/26");

// --- Auth -------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

// --- Students ---------------------------------------------------------------

export const createStudentSchema = z.object({
  firstName: trimmed(80),
  lastName: trimmed(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  dateOfBirth: dateFromInput.refine(
    (d) => d < new Date(),
    "Date of birth must be in the past",
  ),
  programmeId: trimmed(40),
  academicYear: academicYearSchema,
  yearOfStudy: z.coerce.number().int().min(1).max(7),
  status: z.enum(EnrolmentStatus).default(EnrolmentStatus.ENROLLED),
  // Optional: bill the programme's standard fee as part of enrolment.
  createFee: z.coerce.boolean().default(false),
  feeDueDate: dateFromInput.optional(),
}).superRefine((value, ctx) => {
  const age = ageOn(value.dateOfBirth, new Date());
  if (age < MIN_AGE || age > MAX_AGE) {
    ctx.addIssue({
      code: "custom",
      path: ["dateOfBirth"],
      message: `Student must be between ${MIN_AGE} and ${MAX_AGE} years old`,
    });
  }
  if (value.createFee && !value.feeDueDate) {
    ctx.addIssue({ code: "custom", path: ["feeDueDate"], message: "Set a due date for the fee" });
  }
});

export const updateStudentSchema = z.object({
  firstName: trimmed(80),
  lastName: trimmed(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  programmeId: trimmed(40),
  academicYear: academicYearSchema,
  yearOfStudy: z.coerce.number().int().min(1).max(7),
});

export const changeStatusSchema = z.object({
  studentId: trimmed(40),
  status: z.enum(EnrolmentStatus),
  reason: z.string().trim().max(500).optional(),
});

export const studentFilterSchema = z.object({
  q: z.string().trim().max(100).optional(),
  programmeId: z.string().trim().optional(),
  status: z.enum(EnrolmentStatus).optional(),
  arrears: z.enum(["overdue", "outstanding"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  sort: z.enum(["name", "studentId", "recent"]).default("name"),
});

// --- Fees & payments --------------------------------------------------------

export const assignFeeSchema = z.object({
  studentId: trimmed(40),
  type: z.enum(FeeType).default(FeeType.TUITION),
  amount: money,
  academicYear: academicYearSchema,
  dueDate: dateFromInput,
  description: z.string().trim().max(200).optional(),
  overrideNote: z.string().trim().max(300).optional(),
});

export const recordPaymentSchema = z.object({
  feeAssignmentId: trimmed(40),
  amount: money,
  paidOn: dateFromInput.refine((d) => d <= endOfToday(), "Payment date cannot be in the future"),
  reference: trimmed(60),
  method: z.enum(PaymentMethod).default(PaymentMethod.BANK_TRANSFER),
  note: z.string().trim().max(200).optional(),
});

// --- Assessments & submissions ---------------------------------------------

export const createAssessmentSchema = z.object({
  title: trimmed(160),
  moduleId: trimmed(40),
  dueAt: dateFromInput,
  weighting: z.coerce.number().int().min(1).max(100).default(100),
  description: z.string().trim().max(500).optional(),
});

export const submitWorkSchema = z.object({
  assessmentId: trimmed(40),
});

// --- Grades -----------------------------------------------------------------

export const enterGradeSchema = z.object({
  assessmentId: trimmed(40),
  studentId: trimmed(40),
  score: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v))),
  isAbsent: z.coerce.boolean().default(false),
  feedback: z.string().trim().max(1000).optional(),
}).superRefine((value, ctx) => {
  if (value.isAbsent) return;
  if (value.score === null || Number.isNaN(value.score)) {
    ctx.addIssue({ code: "custom", path: ["score"], message: "Enter a mark, or record the student absent" });
    return;
  }
  if (!Number.isInteger(value.score) || value.score < MIN_SCORE || value.score > MAX_SCORE) {
    ctx.addIssue({
      code: "custom",
      path: ["score"],
      message: `Marks are whole numbers between ${MIN_SCORE} and ${MAX_SCORE}`,
    });
  }
});

export const publishGradeSchema = z.object({
  gradeId: trimmed(40),
  publish: z.coerce.boolean(),
  withheldReason: z.string().trim().max(300).optional(),
  /** Set when staff knowingly release a result for a student in arrears. */
  overrideArrearsHold: z.coerce.boolean().default(false),
});

export const publishAssessmentSchema = z.object({
  assessmentId: trimmed(40),
  overrideArrearsHold: z.coerce.boolean().default(false),
});

// --- helpers ----------------------------------------------------------------

export function ageOn(dateOfBirth: Date, on: Date): number {
  let age = on.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = on.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && on.getDate() < dateOfBirth.getDate())) age -= 1;
  return age;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Turns a Zod error into the flat `{ field: [messages] }` shape the forms and API share. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    (result[key] ??= []).push(issue.message);
  }
  return result;
}
