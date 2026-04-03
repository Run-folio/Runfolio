import {
  getStravaTokensFromCookies,
  persistStravaTokensToCookies
} from "@/lib/strava-cookies";
import { getStravaClientCredentials } from "@/lib/strava-env";
import { refreshStravaAccessToken } from "@/lib/strava-oauth";

/**
 * Valid access token for server-side Strava calls; refreshes using httpOnly cookies when needed.
 */
export async function getValidStravaAccessToken(): Promise<string | null> {
  const cred = getStravaClientCredentials();
  const jar = await getStravaTokensFromCookies();
  const envAccess = process.env.STRAVA_ACCESS_TOKEN?.trim();
  const envRefresh = process.env.STRAVA_REFRESH_TOKEN?.trim();

  let access = jar.accessToken ?? envAccess;
  const refresh = jar.refreshToken ?? envRefresh;
  const now = Date.now() / 1000;
  const stale = jar.expiresAtSec != null && now > jar.expiresAtSec - 120;

  if (cred && refresh && (!access || stale)) {
    try {
      const t = await refreshStravaAccessToken(refresh, cred.clientId, cred.clientSecret);
      await persistStravaTokensToCookies(t);
      access = t.access_token;
    } catch {
      /* fall through — may still have stale access for one attempt */
    }
  }

  return access ?? null;
}

/**
 * For rate-limit-sensitive flows (historical backfill): return an existing access token without the
 * “refresh 2 minutes before expiry” proactive call. The first Strava HTTP for the user is then typically
 * `GET /athlete/activities`; a 401 triggers refresh inside the list helper instead.
 */
export async function getStravaAccessTokenWithoutProactiveRefresh(): Promise<{
  token: string | null;
  oauthRefreshCount: number;
}> {
  const cred = getStravaClientCredentials();
  const jar = await getStravaTokensFromCookies();
  const envAccess = process.env.STRAVA_ACCESS_TOKEN?.trim();
  const envRefresh = process.env.STRAVA_REFRESH_TOKEN?.trim();

  const access = jar.accessToken ?? envAccess;
  const refresh = jar.refreshToken ?? envRefresh;

  if (access) {
    return { token: access, oauthRefreshCount: 0 };
  }

  if (cred && refresh) {
    try {
      const t = await refreshStravaAccessToken(refresh, cred.clientId, cred.clientSecret);
      await persistStravaTokensToCookies(t);
      return { token: t.access_token, oauthRefreshCount: 1 };
    } catch {
      return { token: null, oauthRefreshCount: 0 };
    }
  }

  return { token: null, oauthRefreshCount: 0 };
}

export async function hasStravaConnection(): Promise<boolean> {
  const jar = await getStravaTokensFromCookies();
  if (jar.accessToken || jar.refreshToken) return true;
  return Boolean(
    process.env.STRAVA_ACCESS_TOKEN?.trim() || process.env.STRAVA_REFRESH_TOKEN?.trim()
  );
}
