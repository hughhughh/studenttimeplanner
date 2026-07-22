import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionPayload } from "@/lib/auth/session";

/**
 * Data Access Layer for auth. `getOptionalUserId` is memoised per request so
 * repeated checks don't re-decrypt the cookie. `verifySession` is the gate for
 * pages and server actions; it redirects unauthenticated users to /login.
 */

export const getOptionalUserId = cache(async (): Promise<string | null> => {
  const session = await getSessionPayload();
  return session?.userId ?? null;
});

export async function verifySession(): Promise<{ userId: string }> {
  const userId = await getOptionalUserId();
  if (!userId) redirect("/login");
  return { userId };
}
