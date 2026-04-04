import Link from "next/link";
import { BACKEND_NOT_CONNECTED_USER_MESSAGE } from "@/lib/backend-config-messages";
import { parseSafeRedirectPath } from "@/lib/safe-redirect-path";
import { getStravaClientCredentials } from "@/lib/strava-env";
type Props = {
  searchParams: Promise<{ next?: string; redirect?: string; supabase?: string; setup?: string; strava_error?: string }>;
};

function stravaErrorHint(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let u = raw.trim();
  try {
    u = decodeURIComponent(u);
  } catch {
    /* ignore */
  }
  switch (u) {
    case "wrong_strava_account":
      return "This Strava account does not match your Runfolio login. Use the same Strava you used when you first signed in.";
    case "reconnect_requires_login":
      return "Sign in with Strava first, then try reconnecting.";
    case "server_misconfigured":
    case "server_unavailable":
      return "Sign-in isn’t available right now. Please try again later. If this keeps happening, contact support.";
    case "invalid_state":
    case "missing_code":
      return "Strava login was interrupted. Try again.";
    case "no_client":
      return "Strava sign-in isn’t set up on this server yet.";
    case "strava_access_denied":
      return "Strava didn’t authorize access. Try again and approve the connection if prompted.";
    case "token_exchange_failed":
      return "We couldn’t finish connecting to Strava. Try signing in again.";
    case "account_setup_failed":
      return "We couldn’t finish setting up your account. Try again, or contact support if this continues.";
    case "session_failed":
      return "We couldn’t start your session after Strava. Try again, or contact support if this continues.";
    case "callback_failed":
    case "athlete_fetch_failed":
    case "no_user":
      return "Something went wrong finishing sign-in. Please try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const nextPath = parseSafeRedirectPath(sp.next ?? sp.redirect ?? "") ?? "/dashboard";
  const setupWarning =
    sp.supabase === "missing"
      ? BACKEND_NOT_CONNECTED_USER_MESSAGE
      : sp.setup
        ? "You’re on the guided setup path — sign in with Strava to continue."
        : null;
  const stravaErr = stravaErrorHint(sp.strava_error);
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
        {stravaErr ? (
          <p className="mb-4 rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-100/95" role="alert">
            {stravaErr}
          </p>
        ) : null}
        {stravaConfigured ? (
          <a
            href={startHref}
            className="inline-flex h-12 w-full items-center justify-center rounded-[12px] bg-accent text-center text-[13px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-[#f08a4d]"
          >
            Continue with Strava
          </a>
        ) : (
          <p className="text-sm text-muted">Strava sign-in is not configured on this server.</p>
        )}
        <p className="mt-6 text-center text-[11px] text-muted leading-relaxed">
          Already connected but sync stopped working?{" "}
          <Link
            href={`/api/strava/oauth/start?mode=reconnect&next=${encodeURIComponent(nextPath)}`}
            className="font-semibold text-accent underline-offset-4 hover:underline"
          >
            Reconnect Strava
          </Link>
        </p>
      </div>
    </main>
  );
}
