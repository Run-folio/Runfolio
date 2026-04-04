import Link from "next/link";
import { AuthEmailSignUpForm } from "@/components/auth-email-sign-up-form";
import { parseSafeRedirectPath } from "@/lib/safe-redirect-path";
import { getStravaClientCredentials } from "@/lib/strava-env";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function SignUpPage({ searchParams }: Props) {
  const sp = await searchParams;
  const nextPath = parseSafeRedirectPath(sp.next ?? "") ?? "/dashboard";
  const stravaConfigured = Boolean(getStravaClientCredentials());
  const startHref = `/api/strava/oauth/start?next=${encodeURIComponent(nextPath)}`;

  return (
    <main className="app-shell flex min-h-screen flex-col items-center justify-center px-4 pb-24 pt-16">
      <div className="w-full max-w-md border border-border bg-panelAlt/95 p-8 shadow-soft">
        <p className="type-eyebrow mb-2">Runfolio</p>

        {stravaConfigured ? (
          <>
            <p className="mb-4 text-sm text-muted">
              Fastest path: connect Strava and we&apos;ll link your athlete profile.
            </p>
            <a
              href={startHref}
              className="inline-flex h-12 w-full items-center justify-center rounded-[12px] bg-accent text-center text-[13px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-[#f08a4d]"
            >
              Continue with Strava
            </a>
            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" aria-hidden />
              <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">or</span>
              <span className="h-px flex-1 bg-border" aria-hidden />
            </div>
          </>
        ) : null}

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
