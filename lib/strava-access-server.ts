import {
  getStravaTokensFromCookies,
  persistStravaTokensToCookies
} from "@/lib/strava-cookies";
import { getStravaClientCredentials } from "@/lib/strava-env";
import { refreshStravaAccessToken } from "@/lib/strava-oauth";
import { createClient } from "@/lib/supabase/server";
import {
  getStravaAccessTokenWithoutProactiveRefreshForUser,
  getValidStravaAccessTokenForUser,
  userHasStravaCredentials
} from "@/lib/strava-credentials-db";

/**
 * Valid access token for Strava: uses DB credentials for the signed-in user, then legacy cookies/env.
 */
export async function getValidStravaAccessToken(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (user?.id) {
      const fromDb = await getValidStravaAccessTokenForUser(user.id);
      if (fromDb) return fromDb;
    }
  } catch {
    /* fall through */
  }

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
      /* fall through */
    }
  }

  return access ?? null;
}

export async function getStravaAccessTokenWithoutProactiveRefresh(): Promise<{
  token: string | null;
  oauthRefreshCount: number;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (user?.id) {
      const fromDb = await getStravaAccessTokenWithoutProactiveRefreshForUser(user.id);
      if (fromDb.token) return fromDb;
    }
  } catch {
    /* fall through */
  }

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
  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (user?.id && (await userHasStravaCredentials(user.id))) {
      return true;
    }
  } catch {
    /* fall through */
  }

  const jar = await getStravaTokensFromCookies();
  if (jar.accessToken || jar.refreshToken) return true;
  return Boolean(
    process.env.STRAVA_ACCESS_TOKEN?.trim() || process.env.STRAVA_REFRESH_TOKEN?.trim()
  );
}
