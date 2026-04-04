import Link from "next/link";
import { BACKEND_NOT_CONNECTED_USER_MESSAGE } from "@/lib/backend-config-messages";
import { parseSafeRedirectPath } from "@/lib/safe-redirect-path";
import { getStravaClientCredentials } from "@/lib/strava-env";
type Props = {
  searchParams: Promise<{ next?: string; redirect?: string; supabase?: string; setup?: string; strava_error?: string }>;
};

function stravaErrorHint(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const u = decodeURIComponent(raw);
  switch (u) {
    case "wrong_strava_account":
      return "This Strava account does not match your Runfolio login. Use the same Strava you used when you first signed in.";
    case "reconnect_requires_login":
      return "Sign in with Strava first, then try reconnecting.";
    case "server_misconfigured":
      return "The server is missing SUPABASE_SERVICE_ROLE_KEY. Add it so Strava login can create your session.";
    case "invalid_state":
    case "missing_code":
      return "Strava login was interrupted. Try again.";
    case "no_client":
      return "Strava is not configured on this server (missing STRAVA_CLIENT_ID / SECRET).";
    default:
      if (u.length > 180) return `${u.slice(0, 180)}…`;
      return u;
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
          <p className="text-sm text-muted">
            Strava OAuth is not configured. Set <code className="text-xs">STRAVA_CLIENT_ID</code> and{" "}
            <code className="text-xs">STRAVA_CLIENT_SECRET</code>.
          </p>
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
