import Link from "next/link";
import { AuthEmailSignInForm } from "@/components/auth-email-sign-in-form";
import { BACKEND_NOT_CONNECTED_USER_MESSAGE } from "@/lib/backend-config-messages";
import { OVERVIEW_PATH } from "@/lib/app-paths";
import { parseSafeRedirectPath } from "@/lib/safe-redirect-path";

type Props = {
  searchParams: Promise<{
    next?: string;
    redirect?: string;
    supabase?: string;
    setup?: string;
    strava_error?: string;
    notice?: string;
  }>;
};

/** Hints when redirected from OAuth or connection failures. */
function stravaConnectionHint(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let u = raw.trim();
  try {
    u = decodeURIComponent(u);
  } catch {
    /* ignore */
  }
  switch (u) {
    case "wrong_strava_account":
      return "This Strava athlete doesn’t match a previous connection. Disconnect Strava in Settings and connect the correct account.";
    case "connect_requires_login":
      return "Sign in with email first, then connect Strava from Settings or My Races.";
    case "strava_access_denied":
      return "Strava didn’t approve the connection. You can try again after signing in.";
    case "invalid_state":
    case "missing_code":
      return "The connection flow was interrupted. Sign in, then try Connect Strava again.";
    case "oauth_config":
      return "Server OAuth isn’t configured correctly. Check STRAVA_REDIRECT_URI.";
    case "credentials_save_failed":
      return "Strava authorized, but saving tokens failed. Check server logs and SUPABASE_SERVICE_ROLE_KEY.";
    default:
      return null;
  }
}

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const nextPath = parseSafeRedirectPath(sp.next ?? sp.redirect ?? "") ?? OVERVIEW_PATH;
  const setupWarning =
    sp.supabase === "missing"
      ? BACKEND_NOT_CONNECTED_USER_MESSAGE
      : sp.setup
        ? "Finish setup anytime — sign in below to continue."
        : null;
  const stravaHint = stravaConnectionHint(sp.strava_error);
  const showStravaBanner = Boolean(sp.strava_error?.trim());
  const needsStravaSignInNotice = sp.notice === "strava_requires_signin";

  return (
    <main className="app-shell flex min-h-screen flex-col items-center justify-center px-4 pb-24 pt-16">
      <div className="w-full max-w-md border border-border bg-panelAlt/95 p-8 shadow-soft">
        <p className="type-eyebrow mb-2">Runfolio</p>
        <h1 className="mb-2 text-2xl font-bold uppercase tracking-[0.06em]">Sign in</h1>
        <p className="mb-6 text-sm leading-relaxed text-white/65">
          Use your email and password. After you sign in, connect Strava in Settings or My Races to import races and sync
          activities.
        </p>
        {setupWarning ? (
          <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/95">
            {setupWarning}
          </p>
        ) : null}
        {needsStravaSignInNotice ? (
          <p className="mb-4 rounded-lg border border-sky-500/35 bg-sky-950/40 px-3 py-2 text-sm text-sky-100/95" role="status">
            Sign in first, then you can connect Strava to import your races.
          </p>
        ) : null}
        {showStravaBanner ? (
          <div
            className="mb-6 rounded-lg border border-amber-500/35 bg-amber-500/[0.08] px-3 py-3 text-sm text-amber-100/95"
            role="status"
          >
            <p>Strava connection didn’t finish. You can continue with email below.</p>
            {stravaHint ? <p className="mt-2 text-xs leading-relaxed text-amber-200/85">{stravaHint}</p> : null}
          </div>
        ) : null}

        <AuthEmailSignInForm nextPath={nextPath} stravaFailed={showStravaBanner} />

        <p className="mt-6 text-center text-sm text-muted">
          New to Runfolio?{" "}
          <Link
            href={`/auth/signup?next=${encodeURIComponent(nextPath)}`}
            className="font-semibold text-teal underline-offset-4 hover:text-teal-hover hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
