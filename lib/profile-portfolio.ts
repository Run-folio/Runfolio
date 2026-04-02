import type { ProfileStravaMediumMatch, Race, StravaRaceCandidate } from "@/types";
import { getDiscoverRaceById } from "@/lib/known-race-match";
import { rankRacesForProfileTopRaces } from "@/lib/top-race-rank";

const DATE_MATCH_MAX_DAYS = 5;

function parseIso(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(`${iso}T12:00:00`).getTime();
  return Number.isNaN(t) ? null : t;
}

function sameFinishWindow(a: string | null, b: string | null): boolean {
  const ta = parseIso(a);
  const tb = parseIso(b);
  if (ta == null || tb == null) return false;
  return Math.abs(ta - tb) <= DATE_MATCH_MAX_DAYS * 86400000;
}

/** @deprecated Prefer `rankRacesForProfileTopRaces` when badges/scores matter. */
export function sortPortfolioTopRaces(races: Race[]): Race[] {
  return rankRacesForProfileTopRaces(races).map((r) => r.race);
}

function dbCoversStravaEffort(dbCompleted: Race[], c: StravaRaceCandidate, discoverId: string): boolean {
  const sid = c.strava_id;
  for (const r of dbCompleted) {
    if (r.strava_activity_id && r.strava_activity_id === sid) return true;
    if (
      r.discover_race_id === discoverId &&
      r.is_completed &&
      sameFinishWindow(r.date, c.start_date.slice(0, 10))
    ) {
      return true;
    }
  }
  return false;
}

export function buildVirtualRaceFromStravaHighMatch(
  c: StravaRaceCandidate,
  userId: string
): Race | null {
  const s = c.catalogSuggestion;
  if (!s || s.confidence !== "high") return null;
  const discover = getDiscoverRaceById(s.discoverRaceId);
  if (!discover) return null;

  const loc = [c.location_city, c.location_country].filter(Boolean).join(", ") || discover.location;
  const desc =
    c.name.trim().toLowerCase() !== s.displayTitle.trim().toLowerCase()
      ? `Strava: ${c.name}`
      : null;

  return {
    id: `strava-virt-${c.strava_id}`,
    user_id: userId,
    name: s.displayTitle,
    location: loc,
    date: c.start_date.slice(0, 10),
    distance_km: c.distance_km,
    elevation_m: c.elevation_m,
    time: c.moving_time_label,
    description: desc,
    is_completed: true,
    created_at: c.start_date,
    strava_activity_id: c.strava_id,
    discover_race_id: s.discoverRaceId
  };
}

/**
 * Owner view: DB completed rows plus high-confidence Strava majors not already represented in the DB.
 */
export function mergeOwnerPortfolioCompleted(
  dbCompleted: Race[],
  stravaEnriched: StravaRaceCandidate[],
  userId: string
): Race[] {
  const virtuals: Race[] = [];
  for (const c of stravaEnriched) {
    const s = c.catalogSuggestion;
    if (!s || s.confidence !== "high") continue;
    if (dbCoversStravaEffort(dbCompleted, c, s.discoverRaceId)) continue;
    const v = buildVirtualRaceFromStravaHighMatch(c, userId);
    if (v) virtuals.push(v);
  }
  const stravaIds = new Set(dbCompleted.map((r) => r.strava_activity_id).filter(Boolean) as string[]);
  const dedupedVirtuals = virtuals.filter((v) => v.strava_activity_id && !stravaIds.has(v.strava_activity_id));
  return [...dbCompleted, ...dedupedVirtuals];
}

export function extractMediumStravaMatchesForProfile(
  stravaEnriched: StravaRaceCandidate[]
): ProfileStravaMediumMatch[] {
  const out: ProfileStravaMediumMatch[] = [];
  for (const c of stravaEnriched) {
    const s = c.catalogSuggestion;
    if (!s || s.confidence !== "medium") continue;
    out.push({
      stravaId: c.strava_id,
      activityTitle: c.name,
      discoverRaceId: s.discoverRaceId,
      displayTitle: s.displayTitle,
      score: s.score,
      reasons: s.reasons,
      onUserBucketList: s.onUserBucketList,
      userRaceId: s.userRaceId,
      date: c.start_date.slice(0, 10),
      distanceKm: c.distance_km,
      elevationM: c.elevation_m,
      movingTimeLabel: c.moving_time_label,
      location: [c.location_city, c.location_country].filter(Boolean).join(", ")
    });
  }
  return out;
}

export function portfolioRaceHref(race: Race): string {
  const sid = race.strava_activity_id?.trim();
  if (sid) return `/activities/${sid}`;
  if (race.discover_race_id) return `/races/${race.discover_race_id}`;
  if (!race.id.startsWith("strava-virt-")) return `/races/${race.id}/activity`;
  return "/races/new";
}
