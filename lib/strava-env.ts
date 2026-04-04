/**
 * Browser-facing origin for this request (Vercel forwards proto/host).
 * Avoid using NEXT_PUBLIC_SITE_URL here by default — if it disagrees with the host the user
 * actually hit (www vs apex, preview vs prod), Strava gets a different redirect_uri on authorize
 * than on token exchange → `invalid_grant` / state cookies not sent to the callback host.
 */
export function getStravaOAuthPublicOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    const host = forwardedHost.split(",")[0].trim();
    const proto = (forwardedProto?.split(",")[0].trim() || "https").replace(/:+$/, "");
    if (host) return `${proto}://${host}`.replace(/\/$/, "");
  }
  return new URL(request.url).origin.replace(/\/$/, "");
}

const CALLBACK_PATH = "/api/strava/oauth/callback";

/**
 * Exact OAuth callback URL Strava will redirect to — must be **identical** on:
 * - GET /api/strava/oauth/start (authorize)
 * - POST https://www.strava.com/oauth/token (code exchange)
 * - Strava app “Authorization Callback Domain” / allowed redirect list
 *
 * Resolution order:
 * 1. `STRAVA_REDIRECT_URI` or `STRAVA_OAUTH_REDIRECT_URI` — full URL (recommended in docs/.env.example)
 * 2. `STRAVA_OAUTH_REDIRECT_ORIGIN` — origin only; path `/api/strava/oauth/callback` is appended
 * 3. Request public origin (forwarded headers or `request.url`) + callback path
 */
export function getStravaRedirectUri(request: Request): string {
  const full =
    process.env.STRAVA_REDIRECT_URI?.trim() ||
    process.env.STRAVA_OAUTH_REDIRECT_URI?.trim();
  if (full) {
    return full.replace(/\/$/, "");
  }
  const originOnly = process.env.STRAVA_OAUTH_REDIRECT_ORIGIN?.trim().replace(/\/$/, "");
  if (originOnly) {
    return `${originOnly}${CALLBACK_PATH}`;
  }
  return `${getStravaOAuthPublicOrigin(request)}${CALLBACK_PATH}`;
}

export function getStravaClientCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.STRAVA_CLIENT_ID?.trim();
  const clientSecret = process.env.STRAVA_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}
