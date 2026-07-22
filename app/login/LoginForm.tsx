"use client";

import { useActionState } from "react";
import {
  demoLoginAction,
  loginAction,
  type LoginState,
} from "@/app/actions/auth";

const INITIAL: LoginState = { step: "email", email: "" };

export default function LoginForm({ showDemo }: { showDemo: boolean }) {
  const [state, action, pending] = useActionState(loginAction, INITIAL);

  return (
    <div className="w-full max-w-sm">
      <form action={action} className="space-y-3" key={state.step}>
        {state.step === "email" ? (
          <>
            <input type="hidden" name="intent" value="request" />
            <label className="block text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoFocus
              defaultValue={state.email}
              placeholder="you@school.edu"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:opacity-60"
            >
              {pending ? "Sending…" : "Send me a code"}
            </button>
          </>
        ) : (
          <>
            <input type="hidden" name="intent" value="verify" />
            <input type="hidden" name="email" value={state.email} />
            <p className="text-sm text-muted">
              We sent a 6-digit code to <strong>{state.email}</strong>.
            </p>
            {state.devCode && (
              <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent-strong">
                Dev mode: your code is <strong>{state.devCode}</strong>
              </p>
            )}
            <label className="block text-sm font-medium" htmlFor="code">
              Code
            </label>
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              autoFocus
              placeholder="123456"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-center text-lg tracking-[0.4em] focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:opacity-60"
            >
              {pending ? "Verifying…" : "Sign in"}
            </button>
          </>
        )}

        {state.error && <p className="text-sm text-overdue">{state.error}</p>}
      </form>

      {showDemo && (
        <form action={demoLoginAction} className="mt-4">
          <button
            type="submit"
            className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-black/5"
          >
            Continue as demo
          </button>
        </form>
      )}
    </div>
  );
}
