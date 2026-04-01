/** Canonical redirect URI — must match Strava app “Authorization Callback Domain” + path. */
export function getStravaRedirectUri(): string {
  const explicit = process.env.STRAVA_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (site) return `${site}/api/strava/oauth/callback`;
  return "http://localhost:3000/api/strava/oauth/callback";
}

export function getStravaClientCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.STRAVA_CLIENT_ID?.trim();
  const clientSecret = process.env.STRAVA_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}
