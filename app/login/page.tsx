import { redirect } from "next/navigation";
import Link from "next/link";
import { getOptionalUserId } from "@/lib/auth/dal";
import LoginForm from "@/app/login/LoginForm";
import SiteFooter from "@/app/_components/SiteFooter";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  const userId = await getOptionalUserId();
  if (userId) redirect("/planner");

  return (
    <div className="flex min-h-full flex-col">
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight"
          >
            <span
              aria-hidden
              className="inline-block size-3 rounded-full bg-accent"
            />
            Student Time <span className="text-accent">Planner</span>
          </Link>
          <p className="mt-2 text-sm text-muted">
            Sign in with a one-time code. No password to remember.
          </p>
        </div>
        <div className="mt-8 flex w-full justify-center">
          <LoginForm />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
