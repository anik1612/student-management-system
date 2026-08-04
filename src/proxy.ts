import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

/**
 * Next 16 renamed `middleware` to `proxy`. This is an optimistic routing check only: it keeps
 * signed-out users off the app shell and stops a student landing on a staff URL. Every server
 * action and route handler re-checks authorisation itself — see requireStaff/requireStudent.
 *
 * `/api/*` is intentionally not matched: those handlers guard themselves, and letting proxy see
 * them would make Next buffer multipart upload bodies twice.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    if (pathname === "/login") return NextResponse.next();
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const home = session.role === "STAFF" ? "/staff" : "/student";

  if (pathname === "/login" || pathname === "/") {
    return NextResponse.redirect(new URL(home, request.url));
  }
  if (pathname.startsWith("/staff") && session.role !== "STAFF") {
    return NextResponse.redirect(new URL("/student", request.url));
  }
  if (pathname.startsWith("/student") && session.role !== "STUDENT") {
    return NextResponse.redirect(new URL("/staff", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/staff/:path*", "/student/:path*"],
};
