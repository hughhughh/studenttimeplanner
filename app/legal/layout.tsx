import Link from "next/link";
import SiteFooter from "@/app/_components/SiteFooter";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Student Time <span className="text-accent">Planner</span>
          </Link>
          <Link
            href="/"
            className="text-sm text-muted transition hover:text-foreground"
          >
            Home
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        {children}
      </main>
      <SiteFooter note="legal notices" />
    </div>
  );
}
