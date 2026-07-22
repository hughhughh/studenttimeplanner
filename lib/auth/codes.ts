import "server-only";
import { createHash, randomInt } from "node:crypto";
import {
  deleteLoginCode,
  findOrCreateUser,
  getLoginCode,
  incrementCodeAttempts,
  saveLoginCode,
} from "@/lib/db/users";
import { resendConfigured, sendLoginCode } from "@/lib/auth/email";
import { createSession } from "@/lib/auth/session";

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function hashCode(email: string, code: string): string {
  return createHash("sha256")
    .update(`${email.trim().toLowerCase()}:${code}`)
    .digest("hex");
}

export async function requestLoginCode(
  email: string
): Promise<{ ok: boolean; devCode?: string }> {
  await findOrCreateUser(email);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000);
  await saveLoginCode(email, hashCode(email, code), expiresAt);
  await sendLoginCode(email, code);
  // In dev (no Resend) we surface the code to the UI so sign-in is testable.
  return { ok: true, devCode: resendConfigured() ? undefined : code };
}

export async function verifyLoginCode(
  email: string,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  const record = await getLoginCode(email);
  if (!record) {
    return { ok: false, error: "Request a new code." };
  }
  if (record.expiresAt.getTime() < Date.now()) {
    await deleteLoginCode(email);
    return { ok: false, error: "That code expired. Request a new one." };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    await deleteLoginCode(email);
    return { ok: false, error: "Too many attempts. Request a new code." };
  }
  if (record.codeHash !== hashCode(email, code)) {
    await incrementCodeAttempts(email);
    return { ok: false, error: "Incorrect code." };
  }

  await deleteLoginCode(email);
  const userId = await findOrCreateUser(email);
  await createSession(userId, email.trim().toLowerCase());
  return { ok: true };
}
