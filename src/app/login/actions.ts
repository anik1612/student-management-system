"use server";

import { redirect } from "next/navigation";
import { authenticate } from "@/lib/services/auth";
import { endSession, startSession } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validation/schemas";
import type { ActionResult } from "@/lib/errors";

export async function login(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Enter your email address and password", code: "VALIDATION_ERROR" };
  }

  // Shared with POST /api/auth/login — one code path decides who you are.
  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) {
    return { ok: false, error: "Email address or password is incorrect", code: "UNAUTHORISED" };
  }

  await startSession(user);

  // Only same-origin paths inside the caller's own area are honoured, so `?next=` cannot be used
  // as an open redirect.
  const next = String(formData.get("next") ?? "");
  const home = user.role === "STAFF" ? "/staff" : "/student";
  const destination =
    next.startsWith("/") && !next.startsWith("//") && next.startsWith(home) ? next : home;

  redirect(destination);
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/login");
}
