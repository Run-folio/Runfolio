import Link from "next/link";
import { AuthEmailSignInForm } from "@/components/auth-email-sign-in-form";
import { BACKEND_NOT_CONNECTED_USER_MESSAGE } from "@/lib/backend-config-messages";
import { parseSafeRedirectPath } from "@/lib/safe-redirect-path";
import { getStravaClientCredentials } from "@/lib/strava-env";

type Props = {
  searchParams: Promise<{ next?: string; redirect?: string; supabase?: string; setup?: string; strava_error?: string }>;
};

/** Optional second line when the user can act on the Strava outcome. */
function stravaFailureDetail(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let u = raw.trim();
  try {
    u = decodeURIComponent(u);
  } catch {
    /* ignore */
  }
  switch (u) {
    case "wrong_strava_account":
      return "This Strava profile doesn’t match the account you used before. Use the same Strava, or sign in with email.";
    case "reconnect_requires_login":
      return "Sign in first, then use Reconnect Strava from this page.";
    case "strava_access_denied":
      return "Strava didn’t approve the connection. Try again if you want to use Strava next time.";
    case "invalid_state":
    case "missing_code":
      return "The Strava login flow was interrupted. You can retry Strava above or use email.";
    default:
      return null;
  }
}

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const nextPath = parseSafeRedirectPath(sp.next ?? sp.redirect ?? "") ?? "/dashboard";
  const setupWarning =
    sp.supabase === "missing"
      ? BACKEND_NOT_CONNECTED_USER_MESSAGE
      : sp.setup
        ? "Finish setup anytime — sign in below to continue."
        : null;
  const stravaFailure = Boolean(sp.strava_error?.trim());
  const stravaDetail = stravaFailureDetail(sp.strava_error);
  const stravaConfigured = Boolean(getStravaClientCredentials());

  const startHref = `/api/strava/oauth/start?next=${encodeURIComponent(nextPath)}`;

  return (
    <main className="app-shell flex min-h-screen flex-col items-center justify-center px-4 pb-24 pt-16">
      <div className="w-full max-w-md border border-border bg-panelAlt/95 p-8 shadow-soft">
        <p className="type-eyebrow mb-2">Runfolio</p>
        <h1 className="mb-6 text-2xl font-bold uppercase tracking-[0.06em]">Sign in</h1>
        {setupWarning ? (
          <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/95">
            {setupWarning}
          </p>
        ) : null}
        {stravaFailure ? (
          <div
            className="mb-6 rounded-lg border border-amber-500/35 bg-amber-500/[0.08] px-3 py-3 text-sm text-amber-100/95"
            role="status"
          >
            <p>Strava sign-in didn’t complete. You can still sign in with email below.</p>
            {stravaDetail ? <p className="mt-2 text-xs leading-relaxed text-amber-200/85">{stravaDetail}</p> : null}
          </div>
        ) : null}

        {stravaConfigured ? (
          <a
            href={startHref}
            className="inline-flex h-12 w-full items-center justify-center rounded-[12px] bg-accent text-center text-[13px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-[#f08a4d]"
          >
            Continue with Strava
          </a>
        ) : (
          <p className="text-center text-sm text-muted">Strava isn’t configured here — use email to sign in.</p>
        )}

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" aria-hidden />
          <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">or</span>
          <span className="h-px flex-1 bg-border" aria-hidden />
        </div>

        <AuthEmailSignInForm nextPath={nextPath} stravaFailed={stravaFailure} />

        <p className="mt-6 text-center text-sm text-muted">
          New to Runfolio?{" "}
          <Link
            href={`/auth/signup?next=${encodeURIComponent(nextPath)}`}
            className="font-semibold text-accent underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>

        {stravaConfigured ? (
          <p className="mt-6 border-t border-border pt-6 text-center text-[11px] text-muted leading-relaxed">
            Already connected but sync stopped?{" "}
            <Link
              href={`/api/strava/oauth/start?mode=reconnect&next=${encodeURIComponent(nextPath)}`}
              className="font-semibold text-accent underline-offset-4 hover:underline"
            >
              Reconnect Strava
            </Link>
          </p>
        ) : null}
      </div>
    </main>
  );
}
