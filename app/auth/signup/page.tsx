import Link from "next/link";
import { AuthEmailSignUpForm } from "@/components/auth-email-sign-up-form";
import { parseSafeRedirectPath } from "@/lib/safe-redirect-path";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function SignUpPage({ searchParams }: Props) {
  const sp = await searchParams;
  const nextPath = parseSafeRedirectPath(sp.next ?? "") ?? "/dashboard";

  return (
    <main className="app-shell flex min-h-screen flex-col items-center justify-center px-4 pb-24 pt-16">
      <div className="w-full max-w-md border border-border bg-panelAlt/95 p-8 shadow-soft">
        <p className="type-eyebrow mb-2">Runfolio</p>
        <p className="mb-6 text-sm leading-relaxed text-white/65">
          Create an account with email. You can connect Strava later from Settings or My Races to import races and sync
          activities.
        </p>

        <AuthEmailSignUpForm nextPath={nextPath} />

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link
            href={`/auth/login?next=${encodeURIComponent(nextPath)}`}
            className="font-semibold text-accent underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
