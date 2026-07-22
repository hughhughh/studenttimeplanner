import type { Metadata } from "next";
import { Source_Serif_4 } from "next/font/google";
import Link from "next/link";
import FolioToc from "@/app/folio/_components/FolioToc";
import FolioSections from "@/app/folio/_content/FolioSections";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-folio-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Project folio — Student Time Planner",
  description:
    "Design and build documentation for Student Time Planner: problem definition, data design, algorithms, and automated testing.",
};

export default function FolioPage() {
  return (
    <div className={`${sourceSerif.variable} min-h-full bg-background`}>
      <header className="sticky top-0 z-20 border-b border-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">
              Design documentation
            </p>
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">
              Student Time Planner —{" "}
              <span className="text-accent">Project folio</span>
            </h1>
          </div>
          <nav className="flex shrink-0 items-center gap-3 text-sm">
            <Link
              href="/"
              className="text-muted transition hover:text-foreground"
            >
              Home
            </Link>
            <Link
              href="/planner"
              className="rounded-full bg-accent px-3 py-1.5 font-semibold text-white transition hover:bg-accent-strong"
            >
              Open planner
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-10 px-4 py-8 sm:px-6 lg:py-10">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
            <FolioToc />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-8 rounded-2xl border border-border bg-accent-soft/50 p-5 sm:p-6">
            <p className="font-serif text-lg leading-relaxed text-foreground/90">
              This folio documents how <strong>Student Time Planner</strong> was
              designed and built — an AI-assisted weekly study planner that helps
              students know what to do and when, using Next.js, TypeScript,
              MongoDB, and Gemini.
            </p>
          </div>

          <div className="lg:hidden">
            <details className="mb-6 rounded-xl border border-border p-3">
              <summary className="cursor-pointer text-sm font-semibold">
                Contents
              </summary>
              <div className="mt-3">
                <FolioToc />
              </div>
            </details>
          </div>

          <div className="font-[family-name:var(--font-folio-serif)]">
            <FolioSections />
          </div>
        </main>
      </div>

      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted">
        Student Time Planner · project folio
      </footer>
    </div>
  );
}
