import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalStravaRaceMatch, CanonicalStravaSuggestion } from "@/lib/strava-canonical-match/suggestions";
import {
  CANONICAL_MATCH_MIN_SCORE,
  rankCanonicalMatchesForSyncedRow,
  suggestionFromRanked
} from "@/lib/strava-canonical-match/suggestions";
import type { StravaSyncedActivityRow } from "@/lib/strava-sync/types";
import { listDismissedCanonicalStravaIds, listSyncedActivitiesForUser } from "@/lib/strava-sync/repository";
import type { Race } from "@/types";

export type MatchHubUnmatchedItem = {
  row: StravaSyncedActivityRow;
  /** Best-effort catalog hints (may be empty or low score). */
  weakCandidates: CanonicalStravaRaceMatch[];
};

export type MatchHubSnoozedItem = { row: StravaSyncedActivityRow };

export type RecentlyConfirmedFinish = {
  id: string;
  name: string;
  date: string | null;
  stravaActivityId: string;
  canonicalRaceId: string | null;
  displayRaceName: string;
  updatedAt: string;
};

function portfolioStravaIdsFromRaces(races: Race[]): Set<string> {
  return new Set(races.map((r) => r.strava_activity_id).filter((x): x is string => Boolean(x?.trim())));
}

function isHubQueueRow(row: StravaSyncedActivityRow): boolean {
  if (!row.potential_race_activity || row.linked_portfolio_race_id) return false;
  if (row.match_hub_status?.trim() === "not_race") return false;
  return true;
}

/**
 * Central Match & Import hub data: confidence bands, unmatched race-like sync rows, snoozed, recent finishes.
 * Persistence: `strava_synced_*`, `strava_canonical_match_dismissals`, `races`, `canonical_races`.
 */
export type MatchHubBundle = {
  suggestedHigh: CanonicalStravaSuggestion[];
  needsReview: CanonicalStravaSuggestion[];
  unmatched: MatchHubUnmatchedItem[];
  snoozed: MatchHubSnoozedItem[];
  recentlyConfirmed: RecentlyConfirmedFinish[];
  /** Total Strava rows stored for this user (including already linked). */
  totalSyncedCount: number;
};

export async function loadMatchHubBundle(
  supabase: SupabaseClient,
  userId: string,
  portfolioRaces: Race[]
): Promise<MatchHubBundle> {
  const rows = await listSyncedActivitiesForUser(supabase, userId);
  const dismissed = await listDismissedCanonicalStravaIds(supabase, userId);
  const portfolioStrava = portfolioStravaIdsFromRaces(portfolioRaces);

  const suggestedHigh: CanonicalStravaSuggestion[] = [];
  const needsReview: CanonicalStravaSuggestion[] = [];
  const unmatched: MatchHubUnmatchedItem[] = [];
  const snoozed: MatchHubSnoozedItem[] = [];

  for (const row of rows) {
    if (!isHubQueueRow(row)) continue;
    if (dismissed.has(row.strava_activity_id)) continue;
    if (portfolioStrava.has(row.strava_activity_id)) continue;

    if (row.match_hub_status?.trim() === "snoozed") {
      snoozed.push({ row });
      continue;
    }

    const ranked = await rankCanonicalMatchesForSyncedRow(row);
    const s = ranked.length ? suggestionFromRanked(row, ranked) : null;

    if (!s?.topMatch) {
      unmatched.push({
        row,
        weakCandidates: ranked.slice(0, 5)
      });
      continue;
    }

    if (s.topMatch.confidence === "high") {
      suggestedHigh.push(s);
    } else {
      needsReview.push(s);
    }
  }

  const sortS = (a: CanonicalStravaSuggestion, b: CanonicalStravaSuggestion) =>
    (b.topMatch?.score ?? 0) - (a.topMatch?.score ?? 0);

  suggestedHigh.sort(sortS);
  needsReview.sort(sortS);

  const { data: recentRaces, error: recentErr } = await supabase
    .from("races")
    .select("id, name, date, strava_activity_id, canonical_race_id, updated_at")
    .eq("user_id", userId)
    .eq("is_completed", true)
    .not("strava_activity_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(16);

  let recentlyConfirmed: RecentlyConfirmedFinish[] = [];
  if (!recentErr && recentRaces?.length) {
    const raw = recentRaces as Array<{
      id: string;
      name: string;
      date: string | null;
      strava_activity_id: string;
      canonical_race_id: string | null;
      updated_at: string;
    }>;
    const canonIds = [...new Set(raw.map((r) => r.canonical_race_id).filter(Boolean))] as string[];
    const canonNameById = new Map<string, string>();
    if (canonIds.length > 0) {
      const { data: crRows } = await supabase.from("canonical_races").select("id,name").in("id", canonIds);
      for (const c of crRows ?? []) {
        canonNameById.set((c as { id: string }).id, (c as { name: string }).name);
      }
    }
    recentlyConfirmed = raw.map((r) => ({
      id: r.id,
      name: r.name,
      date: r.date,
      stravaActivityId: r.strava_activity_id,
      canonicalRaceId: r.canonical_race_id,
      displayRaceName: r.canonical_race_id ? canonNameById.get(r.canonical_race_id) ?? r.name : r.name,
      updatedAt: r.updated_at
    }));
  }

  return {
    suggestedHigh,
    needsReview,
    unmatched,
    snoozed,
    recentlyConfirmed,
    totalSyncedCount: rows.length
  };
}

export { CANONICAL_MATCH_MIN_SCORE };
