import Link from "next/link";

const LINKS = [
  { href: "/legal/terms", label: "Terms of service" },
  { href: "/legal/privacy", label: "Privacy policy" },
  { href: "/legal/data-retention", label: "Data retention" },
] as const;

export default function SiteFooter({
  note = "Year 12 Software Engineering project",
}: {
  note?: string;
}) {
  return (
    <footer className="mt-auto border-t border-border bg-surface-muted/40">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted">
          Student Time Planner · {note}
        </p>
        <nav
          aria-label="Legal"
          className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted transition hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
