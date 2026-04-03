import type { StravaFeedActivity } from "@/types";
import { isStravaRaceCandidateActivity } from "@/lib/strava-race-candidates";

const RACE_NAME_RE =
/** race-like title tokens */
/\b(ultra|marathon|half\s*marathon|50k|50\s*k|100k|100\s*k|100\s*miler|miler|trail|race|utmb|ccc|occ|trom\b|bq\b|escape|revel|jfk|western\s*states|leadville|hardrock|badwater|diagonale|marathon\s+de)/i;

const CLASSIC_KM = [21.1, 42.2, 42.195, 50, 80, 100, 160.9, 161, 100 * 1.60934];

function nearClassicRaceDistance(km: number): boolean {
  for (const c of CLASSIC_KM) {
    const r = Math.abs(km - c) / c;
    if (r <= 0.04) return true;
  }
  return false;
}

function raceLikeName(name: string): boolean {
  return RACE_NAME_RE.test(name);
}

function eventStyleEffort(a: StravaFeedActivity): boolean {
  const k = a.kudos_count ?? 0;
  const ach = a.achievement_count ?? 0;
  if (k >= 25) return true;
  if (ach >= 6) return true;
  const mv = Math.max(1, a.moving_time_sec);
  const el = a.elapsed_time_sec ?? mv;
  if (el / mv >= 1.35 && a.distance_km >= 30) return true;
  return false;
}

function hasVisualSignal(a: StravaFeedActivity): boolean {
  return Boolean(a.primary_photo_url?.trim());
}

const RUN_LIKE_SPORTS = new Set(["Run", "Trail Run", "TrailRun", "Race", "VirtualRun"]);

function isRunLikeSport(a: StravaFeedActivity): boolean {
  const s = (a.sport_type ?? "").trim();
  const t = (a.type ?? "").trim();
  return RUN_LIKE_SPORTS.has(s) || RUN_LIKE_SPORTS.has(t);
}

/**
 * Derived flag: activity is worth sending through canonical race matching.
 * Extends the ≥21 km Run/Trail/Race gate with softer name, distance, social, or photo signals.
 */
export function computePotentialRaceActivity(a: StravaFeedActivity): boolean {
  if (isRunLikeSport(a) && a.distance_km >= 10 && nearClassicRaceDistance(a.distance_km)) {
    return true;
  }
  if (isStravaRaceCandidateActivity(a)) {
    if (raceLikeName(a.name)) return true;
    if (nearClassicRaceDistance(a.distance_km)) return true;
    if (hasVisualSignal(a)) return true;
    if (eventStyleEffort(a)) return true;
    return true;
  }
  if (a.distance_km >= 12 && raceLikeName(a.name)) return true;
  if (a.distance_km >= 30 && nearClassicRaceDistance(a.distance_km)) return true;
  return false;
}
