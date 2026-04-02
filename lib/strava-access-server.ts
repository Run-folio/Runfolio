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

export async function hasStravaConnection(): Promise<boolean> {
  const jar = await getStravaTokensFromCookies();
  if (jar.accessToken || jar.refreshToken) return true;
  return Boolean(
    process.env.STRAVA_ACCESS_TOKEN?.trim() || process.env.STRAVA_REFRESH_TOKEN?.trim()
  );
}
