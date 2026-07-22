import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, decryptSession } from "@/lib/auth/session";

/**
 * Next.js 16 request proxy (the renamed successor to middleware). Optimistic
 * auth gate: it only reads the signed cookie (no DB) to redirect logged-out
 * users to /login and logged-in users away from /login. The real enforcement
 * still happens in the data layer (verifySession / route handlers).
 */

const PUBLIC_PATHS = new Set(["/home", "/login"]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  // Assessment folio is public so teachers can read theory without signing in.
  if (pathname === "/folio" || pathname.startsWith("/folio/")) return true;
  return false;
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await decryptSession(token);
  const isPublic = isPublicPath(pathname);

  if (!session && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
