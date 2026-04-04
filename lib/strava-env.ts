/**
 * Browser-facing origin for this request (Vercel forwards proto/host).
 * Used only when redirect URI is derived from the request (see {@link resolveStravaRedirectUri}).
 */
export function getStravaOAuthPublicOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    const host = forwardedHost.split(",")[0].trim();
    const proto = (forwardedProto?.split(",")[0].trim() || "https").replace(/:+$/, "");
    if (host) return `${proto}://${host}`.replace(/\/$/, "");
  }
  /** Vercel sets VERCEL_URL (no scheme) when invoked without forwarded headers in rare cases. */
  const vercelUrl = process.env.VERCEL_URL?.trim().replace(/\/$/, "");
  if (vercelUrl && !vercelUrl.includes("://")) {
    return `https://${vercelUrl}`;
  }
  return new URL(request.url).origin.replace(/\/$/, "");
}

/** Path Strava must redirect to — single callback for login and reconnect. */
export const STRAVA_OAUTH_CALLBACK_PATH = "/api/strava/oauth/callback" as const;

export type StravaRedirectUriSource = "env_full" | "env_origin" | "dynamic";

export type ResolveStravaRedirectUriResult =
  | { ok: true; redirectUri: string; source: StravaRedirectUriSource; requestOrigin: string }
  | { ok: false; message: string };

/**
 * Canonical OAuth `redirect_uri`: must be **byte-identical** for:
 * - GET /api/strava/oauth/authorize (query param)
 * - POST https://www.strava.com/oauth/token (form field)
 *
 * Resolution (strict in production):
 * 1. `STRAVA_REDIRECT_URI` or `STRAVA_OAUTH_REDIRECT_URI` — full URL (recommended).
 * 2. `STRAVA_OAUTH_REDIRECT_ORIGIN` — origin only; {@link STRAVA_OAUTH_CALLBACK_PATH} is appended.
 * 3. Request-derived origin + callback path **only** if:
 *    - `STRAVA_REDIRECT_URI_ALLOW_DYNAMIC` is `1` or `true`, **or**
 *    - `NODE_ENV !== "production"` (local DX).
 *
 * Production: set `STRAVA_REDIRECT_URI` to your public HTTPS callback (see Strava app settings).
 */
export function resolveStravaRedirectUri(request: Request): ResolveStravaRedirectUriResult {
  const requestOrigin = getStravaOAuthPublicOrigin(request);
  const full =
    process.env.STRAVA_REDIRECT_URI?.trim() ||
    process.env.STRAVA_OAUTH_REDIRECT_URI?.trim();
  if (full) {
    return {
      ok: true,
      redirectUri: full.replace(/\/$/, ""),
      source: "env_full",
      requestOrigin
    };
  }
  const originOnly = process.env.STRAVA_OAUTH_REDIRECT_ORIGIN?.trim().replace(/\/$/, "");
  if (originOnly) {
    return {
      ok: true,
      redirectUri: `${originOnly}${STRAVA_OAUTH_CALLBACK_PATH}`,
      source: "env_origin",
      requestOrigin
    };
  }
  const allowDynamic =
    process.env.STRAVA_REDIRECT_URI_ALLOW_DYNAMIC === "1" ||
    process.env.STRAVA_REDIRECT_URI_ALLOW_DYNAMIC === "true" ||
    process.env.NODE_ENV !== "production";
  if (!allowDynamic) {
    return {
      ok: false,
      message:
        "Strava OAuth: set STRAVA_REDIRECT_URI to the exact callback URL registered in Strava, or set STRAVA_OAUTH_REDIRECT_ORIGIN. Request-derived redirect_uri is disabled in production unless STRAVA_REDIRECT_URI_ALLOW_DYNAMIC=true."
    };
  }
  return {
    ok: true,
    redirectUri: `${requestOrigin}${STRAVA_OAUTH_CALLBACK_PATH}`,
    source: "dynamic",
    requestOrigin
  };
}

/**
 * Same URI string as {@link resolveStravaRedirectUri}; throws if redirect cannot be resolved.
 * Login and reconnect both use this so authorize + token exchange always match.
 */
export function getStravaRedirectUri(request: Request): string {
  const r = resolveStravaRedirectUri(request);
  if (!r.ok) throw new Error(r.message);
  return r.redirectUri;
}

export function getStravaClientCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.STRAVA_CLIENT_ID?.trim();
  const clientSecret = process.env.STRAVA_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}
