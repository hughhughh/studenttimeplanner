import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data retention — Student Time Planner",
};

export default function DataRetentionPage() {
  return (
    <article className="space-y-4 text-sm leading-relaxed text-foreground/90">
      <h1 className="text-2xl font-bold tracking-tight">Data retention</h1>
      <p className="text-xs text-muted">Last updated: 23 July 2026</p>
      <p>
        Account and calendar data are kept while your account is active so the
        week view keeps working. One-time login codes expire within minutes and
        are not kept as reusable secrets.
      </p>
      <p>
        Demo / guest data may be wiped or reseeded whenever the project is reset
        for marking or development. Production-style accounts can request
        deletion by contacting the project owner; associated calendar items are
        then removed from the application database.
      </p>
      <p>
        Backups and server logs (if any) are retained only as long as needed for
        reliability and debugging, then discarded. AI provider logs follow that
        provider’s own retention rules outside this app.
      </p>
      <p>
        This page is a short educational summary for Assessment 3, not a
        commercial compliance programme.
      </p>
    </article>
  );
}
