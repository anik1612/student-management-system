import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/generated/prisma/enums";
import { forbidden, unauthorised } from "@/lib/errors";

/**
 * Credentials auth without a framework: bcrypt-hashed passwords (see ./password.ts) and a signed
 * HS256 JWT in an httpOnly cookie. Deliberately not NextAuth — its stable release predates the App
 * Router's `proxy` convention, and the v5 beta needs a forced peer-dependency override on Next 16.
 */

export const SESSION_COOKIE = "sms_session";
const SESSION_HOURS = 8;

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  role: Role;
  /** Present for STUDENT sessions: the Student.id they are allowed to see. */
  studentId?: string;
}

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error("AUTH_SECRET must be set and at least 32 characters. See .env.example.");
  }
  return new TextEncoder().encode(value);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.userId || !payload.role) return null;
    return {
      userId: String(payload.userId),
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role: payload.role as Role,
      studentId: payload.studentId ? String(payload.studentId) : undefined,
    };
  } catch {
    // Expired or tampered token — treat as signed out rather than erroring.
    return null;
  }
}

export async function startSession(user: SessionUser): Promise<void> {
  const token = await createSessionToken(user);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Authorisation helpers. These run inside every server action and route handler — `proxy.ts` only
 * redirects browsers to the right page, it is not the security boundary. Server Actions are
 * reachable by direct POST, so the check has to live next to the mutation.
 */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw unauthorised();
  return session;
}

export async function requireStaff(): Promise<SessionUser> {
  const session = await requireSession();
  if (session.role !== "STAFF") throw forbidden("This action is restricted to Registry staff");
  return session;
}

export async function requireStudent(): Promise<SessionUser & { studentId: string }> {
  const session = await requireSession();
  if (session.role !== "STUDENT" || !session.studentId) {
    throw forbidden("This action is restricted to students");
  }
  return session as SessionUser & { studentId: string };
}

/** Staff may read any student; a student may only ever read their own record. */
export async function requireStudentAccess(studentId: string): Promise<SessionUser> {
  const session = await requireSession();
  if (session.role === "STAFF") return session;
  if (session.studentId !== studentId) throw forbidden();
  return session;
}
