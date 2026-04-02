/**
 * Strava OAuth redirect_uri must match the authorize request exactly and be allowed in Strava app settings.
 * Prefer NEXT_PUBLIC_SITE_URL when set; otherwise use the incoming request origin (fixes Vercel when env is missing).
 */
export function getStravaRedirectUri(request: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const siteUrl = fromEnv
    ? fromEnv.replace(/\/$/, "")
    : new URL(request.url).origin.replace(/\/$/, "");
  return `${siteUrl}/api/strava/oauth/callback`;
}

export function getStravaClientCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.STRAVA_CLIENT_ID?.trim();
  const clientSecret = process.env.STRAVA_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}
