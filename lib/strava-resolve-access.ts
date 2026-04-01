import type { NextResponse } from "next/server";
import { fetchStravaActivity } from "@/lib/strava-api";
import type { StravaActivityJson } from "@/lib/strava-api";
import { applyStravaTokensToResponse, getStravaTokensFromCookies } from "@/lib/strava-cookies";
import { getStravaClientCredentials } from "@/lib/strava-env";
import { refreshStravaAccessToken } from "@/lib/strava-oauth";

export type StravaFetchOutcome = {
  activity: StravaActivityJson;
  /** Call on the successful JSON / redirect response so rotated tokens are saved in cookies. */
  applyCookieRotation?: (res: NextResponse) => void;
};

function isLikelyUnauthorized(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("401") || m.includes("unauthorized") || m.includes("authorization");
}

/**
 * Resolve a valid access token (cookies first, then env), refresh when expired or after a failed fetch.
 */
export async function fetchStravaActivityWithRecovery(
  activityId: string
): Promise<StravaFetchOutcome> {
  const cred = getStravaClientCredentials();
  const envAccess = process.env.STRAVA_ACCESS_TOKEN?.trim();
  const envRefresh = process.env.STRAVA_REFRESH_TOKEN?.trim();
  const jar = await getStravaTokensFromCookies();

  let access = jar.accessToken ?? envAccess;
  const refresh = jar.refreshToken ?? envRefresh;

  const now = Date.now() / 1000;
  const stale = jar.expiresAtSec != null && now > jar.expiresAtSec - 120;

  let pendingCookies: ((res: NextResponse) => void) | undefined;

  if (cred && refresh && (!access || stale)) {
    const t = await refreshStravaAccessToken(refresh, cred.clientId, cred.clientSecret);
    access = t.access_token;
    pendingCookies = (res) => applyStravaTokensToResponse(res, t);
  }

  if (!access) {
    throw new Error(
      "No Strava access token. Use “Connect Strava” on Add race or set STRAVA_ACCESS_TOKEN in .env.local."
    );
  }

  try {
    const activity = await fetchStravaActivity(activityId, access);
    return { activity, applyCookieRotation: pendingCookies };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Strava request failed";
    if (!cred || !refresh || !isLikelyUnauthorized(message)) {
      throw e;
    }
    const t = await refreshStravaAccessToken(refresh, cred.clientId, cred.clientSecret);
    const activity = await fetchStravaActivity(activityId, t.access_token);
    return {
      activity,
      applyCookieRotation: (res) => {
        applyStravaTokensToResponse(res, t);
        pendingCookies?.(res);
      }
    };
  }
}
