import type {
  ActivityMatchInput,
  CatalogRaceSuggestion,
  Race,
  RaceMatchCandidate,
  StravaFeedActivity,
  StravaFeedStats,
  StravaRaceCandidate
} from "@/types";
import { rankKnownRaceMatches } from "@/lib/known-race-match";
import { getCatalogDisplayTitle } from "@/lib/discover-race-details";

/** Half marathon minimum — Runfolio only surfaces long race-relevant efforts. */
export const MIN_RACE_CANDIDATE_DISTANCE_KM = 21;

const ALLOWED_SPORT_TYPES = new Set(["Run", "Trail Run", "Race"]);

const EXCLUDED_SPORT_OR_TYPE = new Set([
  "Ride",
  "VirtualRide",
  "EBikeRide",
  "EMountainBikeRide",
  "MountainBikeRide",
  "GravelRide",
  "Velomobile",
  "Swim",
  "WeightTraining",
  "Workout",
  "Crossfit",
  "Yoga",
  "IceSkate",
  "InlineSkate",
  "RockClimbing",
  "Snowboard",
  "AlpineSki",
  "BackcountrySki",
  "NordicSki",
  "Snowshoe",
  "Surfing",
  "Windsurf",
  "Kitesurf",
  "Rowing",
  "Kayaking",
  "Canoeing",
  "StandUpPaddling",
  "Golf",
  "Soccer",
  "Tennis",
  "Pickleball",
  "Wheelchair",
  "Handcycle"
]);

/**
 * True when this Strava summary activity should appear as a Runfolio “race candidate”
 * (long run / trail race effort — not rides, gym, or short runs).
 */
export function isStravaRaceCandidateActivity(a: StravaFeedActivity): boolean {
  if (a.distance_km < MIN_RACE_CANDIDATE_DISTANCE_KM) return false;

  const sport = a.sport_type ?? "";
  const legacyType = a.type ?? "";

  if (EXCLUDED_SPORT_OR_TYPE.has(sport) || EXCLUDED_SPORT_OR_TYPE.has(legacyType)) return false;

  const combined = `${sport} ${legacyType}`.toLowerCase();
  if (combined.includes("ride") || combined.includes("bike") || combined.includes("virtualride")) return false;
  if (combined.includes("weight") || combined.includes("workout") && !combined.includes("run")) return false;

  if (ALLOWED_SPORT_TYPES.has(sport) || ALLOWED_SPORT_TYPES.has(legacyType)) return true;

  // Strava sometimes only populates generic "Run" on type
  if (legacyType === "Run" || sport === "Run") return true;
  if (legacyType === "Trail Run" || sport === "Trail Run") return true;

  return false;
}

export function filterStravaRaceCandidates(activities: StravaFeedActivity[]): StravaFeedActivity[] {
  return activities.filter(isStravaRaceCandidateActivity);
}

function emptyStats(): StravaFeedStats {
  return {
    activityCount: 0,
    runCount: 0,
    totalDistanceKm: 0,
    totalElevationM: 0,
    totalMovingTimeSec: 0,
    longestActivityKm: 0,
    highestElevationM: 0,
    topByDistance: []
  };
}

/** Aggregate stats for a slice of activities (used for race-candidate strip). */
export function computeStravaFeedStats(activities: StravaFeedActivity[]): StravaFeedStats {
  if (activities.length === 0) return emptyStats();
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
  const topByDistance = [...activities].sort((a, b) => b.distance_km - a.distance_km).slice(0, 3);
  return {
    activityCount: activities.length,
    runCount: activities.length,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    totalElevationM: Math.round(totalElevationM),
    totalMovingTimeSec,
    longestActivityKm: Math.round(longestActivityKm * 10) / 10,
    highestElevationM: Math.round(highestElevationM),
    topByDistance
  };
}

function toMatchInput(a: StravaFeedActivity): ActivityMatchInput {
  return {
    strava_id: a.strava_id,
    name: a.name,
    distance_km: a.distance_km,
    date: a.start_date.slice(0, 10),
    elevation_m: a.elevation_m,
    location_city: a.location_city,
    location_country: a.location_country,
    sport_type: a.sport_type,
    type: a.type
  };
}

const SUGGESTION_MIN_SCORE = 0.34;

function candidateFromTopMatch(a: StravaFeedActivity, top: RaceMatchCandidate | undefined): StravaRaceCandidate {
  if (!top || top.score < SUGGESTION_MIN_SCORE) {
    return { ...a, catalogSuggestion: null };
  }
  const suggestion: CatalogRaceSuggestion = {
    discoverRaceId: top.discoverRaceId,
    displayTitle: getCatalogDisplayTitle(top.discoverRaceId),
    confidence: top.confidence,
    score: top.score,
    reasons: top.reasons,
    onUserBucketList: top.onUserBucketList,
    userRaceId: top.userRaceId
  };
  return { ...a, catalogSuggestion: suggestion };
}

/**
 * Attach best catalog match per activity for UI (badges, “likely race” copy). Does not persist.
 */
export function enrichRaceCandidatesWithCatalogMatches(
  candidates: StravaFeedActivity[],
  userRaces: Race[]
): StravaRaceCandidate[] {
  return candidates.map((a) => {
    const ranked = rankKnownRaceMatches(toMatchInput(a), userRaces, 0.28);
    return candidateFromTopMatch(a, ranked[0]);
  });
}

export function dedupeHighConfidenceDiscoverIds(candidates: StravaRaceCandidate[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of candidates) {
    const s = c.catalogSuggestion;
    if (!s || s.confidence !== "high") continue;
    if (seen.has(s.discoverRaceId)) continue;
    seen.add(s.discoverRaceId);
    out.push(s.discoverRaceId);
  }
  return out;
}
