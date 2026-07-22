import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

/**
 * Stateless session: a signed JWT in an HttpOnly cookie. The payload holds only
 * the minimum identity needed (userId + email), never sensitive data.
 */

export const SESSION_COOKIE = "stp_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface SessionPayload {
  userId: string;
  email: string;
  [key: string]: unknown;
}

function key(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
      ? process.env.SESSION_SECRET
      : "stp-dev-insecure-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(key());
}

export async function decryptSession(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (typeof payload.userId === "string" && typeof payload.email === "string") {
      return payload as SessionPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export async function createSession(userId: string, email: string): Promise<void> {
  const token = await encryptSession({ userId, email });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getSessionPayload(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  return decryptSession(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
