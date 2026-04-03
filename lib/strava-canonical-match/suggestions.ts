import {
  confidenceFromScore100,
  explanationSummary,
  scoreActivityAgainstCanonical,
  type ActivityForCanonicalMatch,
  type CanonicalMatchScoreBreakdown
} from "@/lib/strava-canonical-match/score-activity-canonical";
import { CANONICAL_MATCH_MIN_SCORE } from "@/lib/strava-canonical-match/match-policy";
import { loadCanonicalRacesByNameToken, loadCanonicalRacesInDateWindow } from "@/lib/strava-canonical-match/load-candidates";
import type { CanonicalRace } from "@/lib/races/canonical/types";
import type { RaceMatchConfidence } from "@/types";
import type { StravaSyncedActivityRow } from "@/lib/strava-sync/types";
import { isSyncedRowRunLikeForMatchVisibility } from "@/lib/strava-race-candidates";

function rowEligibleForCanonicalMatching(row: StravaSyncedActivityRow): boolean {
  if (row.linked_portfolio_race_id) return false;
  return row.potential_race_activity || isSyncedRowRunLikeForMatchVisibility(row);
}

export type CanonicalStravaRaceMatch = {
  canonicalRaceId: string;
  name: string;
  slug: string;
  confidence: RaceMatchConfidence;
  score: number;
  breakdown: CanonicalMatchScoreBreakdown;
  subtitle: string;
};

export type CanonicalStravaSuggestion = {
  stravaActivityId: string;
  activityTitle: string;
  startDateYmd: string;
  distanceKm: number;
  elevationM: number | null;
  movingTimeSec: number | null;
  city: string | null;
  country: string | null;
  topMatch: CanonicalStravaRaceMatch | null;
  alternatives: CanonicalStravaRaceMatch[];
};

function rowToMatchInput(row: StravaSyncedActivityRow): ActivityForCanonicalMatch {
  return {
    name: row.name,
    distanceKm: row.distance_km ?? 0,
    elevationM: row.elevation_gain_m,
    startDateYmd: row.start_date.slice(0, 10),
    city: row.city,
    country: row.country,
    latitude: row.latitude,
    longitude: row.longitude
  };
}

function rankMatches(act: ActivityForCanonicalMatch, races: CanonicalRace[]) {
  const scored = races.map((race) => {
    const breakdown = scoreActivityAgainstCanonical(act, race);
    const confidence = confidenceFromScore100(breakdown.total);
    return {
      canonicalRaceId: race.id,
      name: race.name,
      slug: race.slug,
      confidence,
      score: breakdown.total,
      breakdown,
      subtitle: explanationSummary(breakdown)
    } satisfies CanonicalStravaRaceMatch;
  });
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

export { CANONICAL_MATCH_MIN_SCORE, CANONICAL_SUGGESTED_HIGH_MIN_SCORE } from "@/lib/strava-canonical-match/match-policy";

const ALTERNATIVE_MIN_SCORE = CANONICAL_MATCH_MIN_SCORE;

export function suggestionFromRanked(
  row: StravaSyncedActivityRow,
  ranked: CanonicalStravaRaceMatch[]
): CanonicalStravaSuggestion | null {
  if (ranked.length === 0) return null;
  const top = ranked[0]!;
  if (top.score < CANONICAL_MATCH_MIN_SCORE) return null;

  const alternatives = ranked.filter((r) => r !== top && r.score >= ALTERNATIVE_MIN_SCORE).slice(0, 5);

  return {
    stravaActivityId: row.strava_activity_id,
    activityTitle: row.name,
    startDateYmd: row.start_date.slice(0, 10),
    distanceKm: row.distance_km ?? 0,
    elevationM: row.elevation_gain_m,
    movingTimeSec: row.moving_time_sec,
    city: row.city,
    country: row.country,
    topMatch: top,
    alternatives
  };
}

/** Loads candidate canonical races and scores them for a synced row (hub + suggestions). */
export async function rankCanonicalMatchesForSyncedRow(
  row: StravaSyncedActivityRow
): Promise<CanonicalStravaRaceMatch[]> {
  if (!rowEligibleForCanonicalMatching(row)) return [];
  const act = rowToMatchInput(row);
  let races = await loadCanonicalRacesInDateWindow(act.startDateYmd, 14);
  if (races.length < 4) {
    const token = act.name.split(/\s+/).find((w) => w.length > 4) ?? act.name.slice(0, 12);
    const extra = await loadCanonicalRacesByNameToken(token);
    const seen = new Set(races.map((r) => r.id));
    for (const r of extra) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        races.push(r);
      }
    }
  }
  if (races.length === 0) return [];
  return rankMatches(act, races);
}

export async function buildCanonicalStravaSuggestionForSyncedRow(
  row: StravaSyncedActivityRow
): Promise<CanonicalStravaSuggestion | null> {
  if (!rowEligibleForCanonicalMatching(row)) return null;
  const ranked = await rankCanonicalMatchesForSyncedRow(row);
  return suggestionFromRanked(row, ranked);
}

function hubExcluded(row: StravaSyncedActivityRow): boolean {
  const st = row.match_hub_status?.trim();
  if (st === "not_race" || st === "snoozed") return true;
  return false;
}

export async function buildCanonicalStravaSuggestionsForUser(opts: {
  rows: StravaSyncedActivityRow[];
  dismissedStravaIds: Set<string>;
  portfolioStravaIds: Set<string>;
}): Promise<CanonicalStravaSuggestion[]> {
  const out: CanonicalStravaSuggestion[] = [];
  for (const row of opts.rows) {
    if (!rowEligibleForCanonicalMatching(row)) continue;
    if (hubExcluded(row)) continue;
    if (opts.dismissedStravaIds.has(row.strava_activity_id)) continue;
    if (opts.portfolioStravaIds.has(row.strava_activity_id)) continue;
    const s = await buildCanonicalStravaSuggestionForSyncedRow(row);
    if (s?.topMatch) out.push(s);
  }
  return out.sort((a, b) => (b.topMatch?.score ?? 0) - (a.topMatch?.score ?? 0));
}
