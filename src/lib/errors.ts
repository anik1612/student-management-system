/**
 * One error vocabulary shared by server actions and API route handlers, so a rule written once in
 * the service layer produces the same message in the UI and over HTTP.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "FORBIDDEN"
  | "UNAUTHORISED"
  | "RULE_VIOLATION"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  RULE_VIOLATION: 422,
  UNAUTHORISED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(code: ErrorCode, message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  get status(): number {
    return STATUS_BY_CODE[this.code];
  }
}

export const notFound = (what: string) => new AppError("NOT_FOUND", `${what} not found`);
export const conflict = (message: string) => new AppError("CONFLICT", message);
export const forbidden = (message = "You do not have access to this record") =>
  new AppError("FORBIDDEN", message);
export const unauthorised = (message = "Please sign in to continue") =>
  new AppError("UNAUTHORISED", message);
/** A request that is well-formed but breaks a registry rule (e.g. overpayment, late resubmission). */
export const ruleViolation = (message: string) => new AppError("RULE_VIOLATION", message);
export const validationError = (message: string, fieldErrors?: Record<string, string[]>) =>
  new AppError("VALIDATION_ERROR", message, fieldErrors);

/** Result shape returned by server actions to their forms. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: ErrorCode; fieldErrors?: Record<string, string[]> };

export function toActionError(error: unknown): Extract<ActionResult, { ok: false }> {
  if (error instanceof AppError) {
    return { ok: false, error: error.message, code: error.code, fieldErrors: error.fieldErrors };
  }
  // Prisma unique-constraint violations that slipped past an explicit check.
  if (isUniqueConstraintError(error)) {
    return {
      ok: false,
      error: `That ${describeUniqueTarget(error)} is already in use`,
      code: "CONFLICT",
    };
  }
  console.error("Unhandled error in server action:", error);
  return { ok: false, error: "Something went wrong. Please try again.", code: "INTERNAL_ERROR" };
}

type PrismaKnownError = { code: string; meta?: { target?: unknown; modelName?: string } };

export function isUniqueConstraintError(error: unknown): error is PrismaKnownError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

export function describeUniqueTarget(error: PrismaKnownError): string {
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.join(" + ");
  if (typeof target === "string") return target;
  return "value";
}
