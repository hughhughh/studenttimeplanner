import "server-only";
import { createSession } from "@/lib/auth/session";

/**
 * The demo account lets the app (and the seed data) be explored without
 * configuring email delivery. "Continue as demo" creates a real session for
 * this user, so the privacy model is identical to a normal sign-in.
 */

export const DEMO_USER_ID = "demo-user";
export const DEMO_EMAIL = "demo@studenttimeplanner.local";

export async function createDemoSession(): Promise<void> {
  await createSession(DEMO_USER_ID, DEMO_EMAIL);
}
