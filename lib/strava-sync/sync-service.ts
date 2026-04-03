import { fetchAllStravaActivitySummaries } from "@/lib/strava-sync/fetch-summaries";
import { upsertStravaSummariesForUser, type SyncSummary } from "@/lib/strava-sync/repository";
import { getValidStravaAccessToken } from "@/lib/strava-access-server";
import { createClient } from "@/lib/supabase/server";
import { refreshStravaAccessToken } from "@/lib/strava-oauth";
import { persistStravaTokensToCookies } from "@/lib/strava-cookies";
import { getStravaClientCredentials } from "@/lib/strava-env";
import { getStravaTokensFromCookies } from "@/lib/strava-cookies";
import { runfolioLog } from "@/lib/runfolio-log";

function isUnauthorizedMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("401") || m.includes("unauthorized");
}

export async function syncStravaActivitiesForUserId(userId: string): Promise<
  SyncSummary & { ok: true } | { ok: false; error: string }
> {
  let access = await getValidStravaAccessToken();
  if (!access) {
    return { ok: false, error: "Connect Strava first." };
  }

  let summaries;
  try {
    summaries = await fetchAllStravaActivitySummaries(access);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Strava list failed";
    const cred = getStravaClientCredentials();
    const jar = await getStravaTokensFromCookies();
    const refresh = jar.refreshToken ?? process.env.STRAVA_REFRESH_TOKEN?.trim();
    if (cred && refresh && isUnauthorizedMessage(message)) {
      try {
        const t = await refreshStravaAccessToken(refresh, cred.clientId, cred.clientSecret);
        await persistStravaTokensToCookies(t);
        summaries = await fetchAllStravaActivitySummaries(t.access_token);
      } catch (e2) {
        runfolioLog.warn("strava.sync", "refresh failed", {
          detail: e2 instanceof Error ? e2.message : "unknown"
        });
        return { ok: false, error: "Strava session expired — reconnect." };
      }
    } else {
      runfolioLog.warn("strava.sync", message);
      return { ok: false, error: message };
    }
  }

  const supabase = await createClient();
  const result = await upsertStravaSummariesForUser(supabase, userId, summaries);
  return { ok: true, ...result };
}
