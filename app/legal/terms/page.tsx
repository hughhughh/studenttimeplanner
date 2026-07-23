import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of service — Student Time Planner",
};

export default function TermsPage() {
  return (
    <article className="space-y-4 text-sm leading-relaxed text-foreground/90">
      <h1 className="text-2xl font-bold tracking-tight">Terms of service</h1>
      <p className="text-xs text-muted">Last updated: 23 July 2026</p>
      <p>
        Student Time Planner is a Year 12 Software Engineering demonstration
        product. By using the site you agree to use it for personal planning
        only, not to abuse the service, and not to attempt to access other
        users’ data.
      </p>
      <p>
        The planner is provided “as is” for educational purposes. Features may
        change, break, or be withdrawn without notice. We are not liable for
        missed homework, timetable mistakes, or AI suggestions you choose to
        follow.
      </p>
      <p>
        Guest / demo accounts are shared demonstration data and may be reset at
        any time. Do not store sensitive personal information in the demo
        calendar.
      </p>
      <p>
        If you do not agree with these terms, do not use the application.
      </p>
    </article>
  );
}
