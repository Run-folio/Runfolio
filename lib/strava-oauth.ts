/**
 * `read` — athlete profile (avatar URL on GET /athlete).
 * `activity:read` + `activity:read_all` — list/read activities.
 */
export const STRAVA_AUTH_SCOPES = ["read", "activity:read", "activity:read_all"].join(",");

export type StravaTokenResponse = {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  /** Present on authorization_code exchange; includes avatar URLs. */
  athlete?: {
    profile_medium?: string | null;
    profile?: string | null;
  };
};

export async function exchangeStravaCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<StravaTokenResponse> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri
  });
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      const j = JSON.parse(text) as { message?: string };
      msg = j.message ?? text;
    } catch {
      /* keep */
    }
    throw new Error(msg || `Strava token exchange failed (${res.status})`);
  }
  return JSON.parse(text) as StravaTokenResponse;
}

export async function refreshStravaAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<StravaTokenResponse> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  });
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      const j = JSON.parse(text) as { message?: string };
      msg = j.message ?? text;
    } catch {
      /* keep */
    }
    throw new Error(msg || `Strava refresh failed (${res.status})`);
  }
  return JSON.parse(text) as StravaTokenResponse;
}

export function stravaAuthorizeUrl(params: { clientId: string; redirectUri: string; state: string }): string {
  const u = new URL("https://www.strava.com/oauth/authorize");
  u.searchParams.set("client_id", params.clientId);
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("approval_prompt", "force");
  u.searchParams.set("scope", STRAVA_AUTH_SCOPES);
  u.searchParams.set("state", params.state);
  return u.toString();
}
