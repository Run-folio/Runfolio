import type {
  ActivityMatchInput,
  CatalogRaceSuggestion,
  DiscoverStravaActivityCandidate,
  Race,
  RaceMatchCandidate,
  StravaFeedActivity,
  StravaFeedStats,
  StravaRaceCandidate
} from "@/types";
import { getDiscoverRaceById, rankKnownRaceMatches, scoreActivityAgainstDiscover } from "@/lib/known-race-match";
import { getCatalogDisplayTitle } from "@/lib/discover-race-details";

/** Half marathon minimum — Runfolio only surfaces long race-relevant efforts. */
export const MIN_RACE_CANDIDATE_DISTANCE_KM = 21;

/** Trail / ultra emphasis — matching & “major effort” flows. */
export const MIN_MAJOR_ULTRA_DISTANCE_KM = 50;

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

export function filterStravaMajorUltraCandidates(activities: StravaFeedActivity[]): StravaFeedActivity[] {
  return activities.filter((a) => a.distance_km >= MIN_MAJOR_ULTRA_DISTANCE_KM && isStravaRaceCandidateActivity(a));
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

export function stravaFeedActivityToMatchInput(a: StravaFeedActivity): ActivityMatchInput {
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
    const ranked = rankKnownRaceMatches(stravaFeedActivityToMatchInput(a), userRaces, 0.28);
    return candidateFromTopMatch(a, ranked[0]);
  });
}

function locationLabel(a: StravaFeedActivity): string {
  return [a.location_city, a.location_country].filter(Boolean).join(", ") || "—";
}

/**
 * Imported Strava activities that might be this catalog race, highest match score first.
 * Skips activities already linked on another portfolio row (`usedStravaIds`).
 */
export function rankStravaActivitiesForDiscoverRace(
  discoverRaceId: string,
  activities: StravaFeedActivity[],
  usedStravaIds: Set<string>,
  opts?: { minScore?: number; limit?: number }
): DiscoverStravaActivityCandidate[] {
  const discover = getDiscoverRaceById(discoverRaceId);
  if (!discover) return [];
  const minScore = opts?.minScore ?? 0.26;
  const limit = opts?.limit ?? 14;
  const out: DiscoverStravaActivityCandidate[] = [];
  for (const a of activities) {
    if (!isStravaRaceCandidateActivity(a)) continue;
    if (usedStravaIds.has(a.strava_id)) continue;
    const m = stravaFeedActivityToMatchInput(a);
    const { score, reasons, confidence } = scoreActivityAgainstDiscover(discover, m);
    if (score < minScore) continue;
    out.push({
      strava_id: a.strava_id,
      name: a.name,
      date: m.date,
      distance_km: a.distance_km,
      elevation_m: a.elevation_m,
      sport_type: a.sport_type,
      type: a.type,
      moving_time_label: a.moving_time_label,
      location_label: locationLabel(a),
      strava_url: a.strava_url,
      score,
      confidence,
      reasons
    });
  }
  return out.sort((x, y) => y.score - x.score).slice(0, limit);
}

/**
 * For manual bucket goals (no catalog id): show recent imported race-like activities so the user can pick a real Strava finish.
 * Sorted newest first; optionally filtered to distances near the goal.
 */
export function stravaActivitiesToPickListCandidates(
  activities: StravaFeedActivity[],
  usedStravaIds: Set<string>,
  opts?: { goalDistanceKm?: number | null; limit?: number }
): DiscoverStravaActivityCandidate[] {
  const limit = opts?.limit ?? 20;
  const gd = opts?.goalDistanceKm;
  let list = activities.filter((a) => isStravaRaceCandidateActivity(a) && !usedStravaIds.has(a.strava_id));
  if (gd != null && gd > 0) {
    list = list.filter((a) => {
      const ratio = Math.abs(a.distance_km - gd) / gd;
      return ratio <= 0.35 || a.distance_km >= gd * 0.55;
    });
  }
  list.sort((a, b) => b.start_date.localeCompare(a.start_date));
  return list.slice(0, limit).map((a) => {
    const m = stravaFeedActivityToMatchInput(a);
    const reasons: string[] = [];
    if (gd != null && gd > 0) {
      const ratio = Math.abs(a.distance_km - gd) / gd;
      if (ratio <= 0.12) reasons.push("Distance is close to your goal");
      else if (ratio <= 0.28) reasons.push("Distance is in range for this goal");
      else reasons.push("Imported long effort — confirm if this was your race");
    } else {
      reasons.push("Imported long run / race-type activity");
    }
    if (a.sport_type || a.type) {
      reasons.push(`Activity type: ${a.sport_type ?? a.type ?? "Run"}`);
    }
    return {
      strava_id: a.strava_id,
      name: a.name,
      date: m.date,
      distance_km: a.distance_km,
      elevation_m: a.elevation_m,
      sport_type: a.sport_type,
      type: a.type,
      moving_time_label: a.moving_time_label,
      location_label: locationLabel(a),
      strava_url: a.strava_url,
      score: 0,
      confidence: "low" as const,
      reasons
    };
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
