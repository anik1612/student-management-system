import "server-only";
import { NextResponse } from "next/server";
import type { ZodError, ZodType } from "zod";
import { AppError, isUniqueConstraintError, describeUniqueTarget } from "@/lib/errors";
import { fieldErrorsFrom } from "@/lib/validation/schemas";

/**
 * Shared plumbing for the REST handlers so every endpoint answers with the same envelope:
 *   success -> the resource
 *   failure -> { error: { code, message, fieldErrors? } }
 */

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(code: string, message: string, status: number, fieldErrors?: Record<string, string[]>) {
  return NextResponse.json({ error: { code, message, fieldErrors } }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof AppError) {
    return fail(error.code, error.message, error.status, error.fieldErrors);
  }
  if (isUniqueConstraintError(error)) {
    return fail("CONFLICT", `That ${describeUniqueTarget(error)} is already in use`, 409);
  }
  // Log the detail server-side; never leak a stack trace to the client.
  console.error("Unhandled API error:", error);
  return fail("INTERNAL_ERROR", "Something went wrong", 500);
}

export function invalid(error: ZodError) {
  return fail("VALIDATION_ERROR", "Invalid request body", 400, fieldErrorsFrom(error));
}

/** Parses JSON or form-encoded bodies against a schema, returning a typed result. */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      raw = await request.json();
    } else {
      raw = Object.fromEntries(await request.formData());
    }
  } catch {
    return { ok: false, response: fail("VALIDATION_ERROR", "Request body could not be read", 400) };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, response: invalid(parsed.error) };
  return { ok: true, data: parsed.data };
}
