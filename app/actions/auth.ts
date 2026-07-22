"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requestLoginCode, verifyLoginCode } from "@/lib/auth/codes";
import { createDemoSession } from "@/lib/auth/user";
import { destroySession } from "@/lib/auth/session";

export interface LoginState {
  step: "email" | "code";
  email: string;
  error?: string;
  devCode?: string;
}

const emailSchema = z.email();

export async function requestCodeAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    return { step: "email", email, error: "Enter a valid email address." };
  }

  try {
    const result = await requestLoginCode(email);
    return { step: "code", email, devCode: result.devCode };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not send a code.";
    const isDb =
      message.includes("MONGODB") || message.includes("MongoServerSelection");
    return {
      step: "email",
      email,
      error: isDb
        ? "Could not send a code. Check the database connection."
        : `Could not send a code: ${message}`,
    };
  }
}

export async function verifyCodeAction(
  prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? prev.email).trim();
  const code = String(formData.get("code") ?? "").trim();

  if (!/^\d{6}$/.test(code)) {
    return { ...prev, step: "code", email, error: "Enter the 6-digit code." };
  }

  const result = await verifyLoginCode(email, code);
  if (!result.ok) {
    return { ...prev, step: "code", email, error: result.error };
  }

  redirect("/");
}

/** Single entry point for the login form's useActionState; branches on intent. */
export async function loginAction(
  prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const intent = String(formData.get("intent") ?? "request");
  if (intent === "verify") {
    return verifyCodeAction(prev, formData);
  }
  return requestCodeAction(prev, formData);
}

export async function demoLoginAction(): Promise<void> {
  await createDemoSession();
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
