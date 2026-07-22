import Link from "next/link";

export const metadata = {
  title: "Student Time Planner — your week, planned",
};

const FEATURES = [
  {
    title: "Talk to your planner",
    body: "“Add an hour of English study tonight.” “Push all school 15 minutes earlier.” Plain language, done.",
  },
  {
    title: "Photograph your timetable",
    body: "Upload a photo of your printed timetable and every subject block appears — fixed, recurring, correct.",
  },
  {
    title: "Stays out of your way",
    body: "Tick tasks off, reschedule what slips, and let the AI reorganise the rest of your week around what's fixed.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-lg font-bold tracking-tight">
          Student Time <span className="text-accent">Planner</span>
        </span>
        <nav className="flex items-center gap-4">
          <Link
            href="/folio"
            className="text-sm font-medium text-muted transition hover:text-foreground"
          >
            Project folio
          </Link>
          <Link
            href="/"
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-strong"
          >
            Open planner
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-6 py-16 text-center">
        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-strong">
          Your week, planned
        </span>
        <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Stop planning your week.{" "}
          <span className="text-accent">Just follow it.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Student Time Planner tells you what to do and when. Add schoolwork and
          life by talking to it or snapping a photo of your timetable — and trust
          it to adapt when things change.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong"
          >
            Open my planner
          </Link>
          <Link
            href="/"
            className="rounded-full border border-border px-6 py-3 text-sm font-semibold transition hover:bg-black/5"
          >
            See the week view
          </Link>
        </div>

        <div className="mt-16 grid w-full gap-4 text-left sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-surface p-5"
            >
              <h2 className="text-sm font-semibold text-accent-strong">
                {f.title}
              </h2>
              <p className="mt-2 text-sm text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="px-6 py-6 text-center text-xs text-muted">
        Student Time Planner · Year 12 Software Engineering project
      </footer>
    </div>
  );
}
