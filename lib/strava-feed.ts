import type { StravaFeedActivity, StravaFeedResult, StravaFeedStats } from "@/types";
import { runfolioLog } from "@/lib/runfolio-log";
import {
  fetchStravaAthleteActivities,
  formatStravaMovingTime,
  pickStravaPrimaryPhotoUrl,
  type StravaSummaryActivityJson
} from "@/lib/strava-api";
import { getValidStravaAccessToken } from "@/lib/strava-access-server";
import { getStravaClientCredentials } from "@/lib/strava-env";
import { getStravaTokensFromCookies, persistStravaTokensToCookies } from "@/lib/strava-cookies";
import { refreshStravaAccessToken } from "@/lib/strava-oauth";
import {
  computeStravaFeedStats,
  filterStravaMajorUltraCandidates,
  filterStravaRaceCandidates
} from "@/lib/strava-race-candidates";

const RUN_LIKE = new Set([
  "Run",
  "Trail Run",
  "VirtualRun",
  "Walk",
  "Hike",
  "Race"
]);

function isRunLike(a: StravaFeedActivity): boolean {
  const s = (a.sport_type || a.type || "").toLowerCase();
  if (RUN_LIKE.has(a.sport_type || "") || RUN_LIKE.has(a.type || "")) return true;
  return s.includes("run") || s === "walk" || s === "hike";
}

export function normalizeStravaSummary(raw: StravaSummaryActivityJson): StravaFeedActivity {
  const id = String(raw.id);
  const distKm = Math.round((raw.distance / 1000) * 100) / 100;
  const elev =
    raw.total_elevation_gain != null && Number.isFinite(raw.total_elevation_gain)
      ? Math.round(raw.total_elevation_gain)
      : null;
  return {
    strava_id: id,
    name: raw.name,
    start_date: raw.start_date,
    start_date_local: raw.start_date_local ?? null,
    distance_m: raw.distance,
    distance_km: distKm,
    moving_time_sec: raw.moving_time,
    moving_time_label: formatStravaMovingTime(raw.moving_time),
    elapsed_time_sec: raw.elapsed_time ?? raw.moving_time,
    elevation_m: elev,
    sport_type: raw.sport_type ?? null,
    type: raw.type ?? null,
    location_city: raw.location_city ?? null,
    location_country: raw.location_country ?? null,
    average_speed_mps: raw.average_speed ?? null,
    max_speed_mps: raw.max_speed ?? null,
    kudos_count: raw.kudos_count ?? 0,
    achievement_count: raw.achievement_count ?? 0,
    summary_polyline: raw.map?.summary_polyline ?? null,
    strava_url: `https://www.strava.com/activities/${id}`,
    primary_photo_url: pickStravaPrimaryPhotoUrl(raw) ?? null,
    description: raw.description?.trim() ? raw.description.trim() : null
  };
}

function emptyFeedResult(errorMessage?: string): StravaFeedResult {
  const empty = computeStravaFeedStats([]);
  return {
    activities: [],
    raceCandidates: [],
    majorUltraCandidates: [],
    stats: empty,
    raceCandidateStats: empty,
    majorUltraStats: empty,
    ok: false,
    errorMessage
  };
}

function computeLegacyStats(activities: StravaFeedActivity[]): StravaFeedStats {
  if (activities.length === 0) return computeStravaFeedStats([]);
  let totalDistanceKm = 0;
  let totalElevationM = 0;
  let totalMovingTimeSec = 0;
  let longestActivityKm = 0;
  let highestElevationM = 0;
  for (const a of activities) {
    totalDistanceKm += a.distance_km;
    totalMovingTimeSec += a.moving_time_sec;
    longestActivityKm = Math.max(longestActivityKm, a.distance_km);
    if (a.elevation_m != null) {
      totalElevationM += a.elevation_m;
      highestElevationM = Math.max(highestElevationM, a.elevation_m);
    }
  }
  const runs = activities.filter(isRunLike);
  const runPool = runs.length > 0 ? runs : activities;
  const topByDistance = [...runPool].sort((a, b) => b.distance_km - a.distance_km).slice(0, 3);
  return {
    activityCount: activities.length,
    runCount: runs.length,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    totalElevationM: Math.round(totalElevationM),
    totalMovingTimeSec,
    longestActivityKm: Math.round(longestActivityKm * 10) / 10,
    highestElevationM: Math.round(highestElevationM),
    topByDistance
  };
}

function isUnauthorizedMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("401") || m.includes("unauthorized");
}

/** Strava returns newest-first; paginate for multi-year major-race discovery (rate-limit aware cap). */
/** Deeper history for global trail / ultra matching (rate-limit aware). */
const STRAVA_FEED_MAX_PAGES = 40;
const STRAVA_FEED_PER_PAGE = 50;
const STRAVA_FEED_MAX_ACTIVITIES = 1400;

async function listWithToken(access: string): Promise<StravaSummaryActivityJson[]> {
  const all: StravaSummaryActivityJson[] = [];
  for (let page = 1; page <= STRAVA_FEED_MAX_PAGES && all.length < STRAVA_FEED_MAX_ACTIVITIES; page++) {
    try {
      const batch = await fetchStravaAthleteActivities(access, {
        page,
        perPage: STRAVA_FEED_PER_PAGE
      });
      all.push(...batch);
      if (batch.length < STRAVA_FEED_PER_PAGE) break;
    } catch {
      break;
    }
  }
  return all;
}

function buildFeedResult(activities: StravaFeedActivity[]): StravaFeedResult {
  const raceCandidates = filterStravaRaceCandidates(activities);
  const majorUltraCandidates = filterStravaMajorUltraCandidates(activities);
  return {
    activities,
    raceCandidates,
    majorUltraCandidates,
    stats: computeLegacyStats(activities),
    raceCandidateStats: computeStravaFeedStats(raceCandidates),
    majorUltraStats: computeStravaFeedStats(majorUltraCandidates),
    ok: true
  };
}

/**
 * Fetch recent Strava activities for the current request (cookies / env token).
 * `activities` is the full loaded set; `raceCandidates` uses `filterStravaRaceCandidates` (~12 km+, run-like).
 */
export async function getStravaFeed(): Promise<StravaFeedResult> {
  let access = await getValidStravaAccessToken();
  if (!access) {
    return emptyFeedResult("Connect Strava to load your activities.");
  }

  try {
    const raw = await listWithToken(access);
    const activities = raw.map(normalizeStravaSummary).sort((a, b) => b.start_date.localeCompare(a.start_date));
    return buildFeedResult(activities);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Strava list failed";
    const cred = getStravaClientCredentials();
    const jar = await getStravaTokensFromCookies();
    const refresh = jar.refreshToken ?? process.env.STRAVA_REFRESH_TOKEN?.trim();

    if (cred && refresh && isUnauthorizedMessage(message)) {
      try {
        const t = await refreshStravaAccessToken(refresh, cred.clientId, cred.clientSecret);
        await persistStravaTokensToCookies(t);
        const raw = await listWithToken(t.access_token);
        const activities = raw.map(normalizeStravaSummary).sort((a, b) => b.start_date.localeCompare(a.start_date));
        return buildFeedResult(activities);
      } catch (e2) {
        runfolioLog.warn("strava.feed", "retry after refresh failed", {
          detail: e2 instanceof Error ? e2.message : "unknown"
        });
      }
    } else {
      runfolioLog.warn("strava.feed", message);
    }

    return emptyFeedResult(message);
  }
}
