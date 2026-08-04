import "server-only";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import type { SessionUser } from "@/lib/auth/session";

/** Bogus but well-formed hash, so a missing user costs the same work as a wrong password. */
const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

/**
 * Verifies credentials. Returns null for both "no such user" and "wrong password" so the response
 * cannot be used to work out which email addresses exist.
 */
export async function authenticate(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { student: { select: { id: true } } },
  });

  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) return null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    studentId: user.student?.id,
  };
}
