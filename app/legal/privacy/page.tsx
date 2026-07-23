import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy policy — Student Time Planner",
};

export default function PrivacyPage() {
  return (
    <article className="space-y-4 text-sm leading-relaxed text-foreground/90">
      <h1 className="text-2xl font-bold tracking-tight">Privacy policy</h1>
      <p className="text-xs text-muted">Last updated: 23 July 2026</p>
      <p>
        We collect the minimum needed to run the planner: your email (for
        one-time sign-in codes), a signed session cookie, and the calendar items
        you create. Passwords are not stored — login uses short-lived email
        codes.
      </p>
      <p>
        Calendar content (titles, times, notes) stays scoped to your account. We
        do not sell personal data. AI features send relevant week context to
        Google Gemini to fulfil your request; do not put highly sensitive
        information into prompts or item titles.
      </p>
      <p>
        Email delivery may use Resend. Hosting and database providers process
        data only to operate the service. See also the{" "}
        <Link
          href="/legal/data-retention"
          className="text-accent-strong underline underline-offset-2"
        >
          data retention
        </Link>{" "}
        notice for how long records are kept.
      </p>
      <p>
        Questions about this educational project can be raised with the course
        teacher. This notice is a simple project summary, not formal legal
        advice.
      </p>
    </article>
  );
}
