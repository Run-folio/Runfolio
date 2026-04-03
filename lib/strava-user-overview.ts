import type { SupabaseClient } from "@supabase/supabase-js";
import { getStravaFeed } from "@/lib/strava-feed";
import {
  listDismissedCanonicalStravaIds,
  listSyncedActivitiesForUser
} from "@/lib/strava-sync/repository";
import { syncedRowToStravaFeedActivity } from "@/lib/strava-sync/synced-row-to-feed";
import { mergeStravaFeedActivitiesWithSynced } from "@/lib/strava-sync/merge-feed-with-synced";
import { isStravaRaceCandidateActivity, isSyncedRowRunLikeForMatchVisibility } from "@/lib/strava-race-candidates";
import type { StravaFeedActivity, StravaFeedResult } from "@/types";
import type { StravaSyncedActivityRow } from "@/lib/strava-sync/types";

export type UserStravaOverviewState = {
  syncedRows: StravaSyncedActivityRow[];
  feed: StravaFeedResult;
  /** For discover / “race candidate” strip: prefer DB sync, else live Strava raceCandidates. */
  raceActivitiesForDiscoverStrip: StravaFeedActivity[];
  /** True when the strip is showing live Strava data because nothing persisted is in the race-candidate bucket yet. */
  usingLiveRacePreviewOnly: boolean;
};

/** Same gates as Match hub queue rows (snooze / not a race / canonical dismissals). */
function isOverviewStripSyncedRow(row: StravaSyncedActivityRow, dismissed: Set<string>): boolean {
  if (row.linked_portfolio_race_id) return false;
  const st = row.match_hub_status?.trim();
  if (st === "not_race" || st === "snoozed") return false;
  if (dismissed.has(row.strava_activity_id)) return false;
  if (!row.potential_race_activity && !isSyncedRowRunLikeForMatchVisibility(row)) return false;
  return true;
}

/**
 * Single load path for Overview + Match & Import: one list sync query and one Strava feed fetch,
 * plus a consistent choice of which activities power the long-run discover strip.
 */
export async function loadUserStravaOverviewState(
  supabase: SupabaseClient,
  userId: string
): Promise<UserStravaOverviewState> {
  const [syncedRows, feed, dismissed] = await Promise.all([
    listSyncedActivitiesForUser(supabase, userId),
    getStravaFeed(),
    listDismissedCanonicalStravaIds(supabase, userId)
  ]);

  const persistedCandidates = syncedRows
    .filter((r) => isOverviewStripSyncedRow(r, dismissed))
    .map(syncedRowToStravaFeedActivity);

  let usingLiveRacePreviewOnly =
    persistedCandidates.length === 0 && feed.ok && feed.raceCandidates.length > 0;

  let raceActivitiesForDiscoverStrip: StravaFeedActivity[] =
    persistedCandidates.length > 0 ? persistedCandidates : feed.ok ? feed.raceCandidates : [];

  // When falling back to live API strip, apply the same ≥21 km / run-type filter as Match hub auto-suggestions.
  if (persistedCandidates.length === 0 && (feed.ok || syncedRows.length > 0)) {
    const merged = mergeStravaFeedActivitiesWithSynced(feed.ok ? feed.activities : [], syncedRows);
    const fromMerged = merged.filter((a) => isStravaRaceCandidateActivity(a));
    if (fromMerged.length > 0) {
      raceActivitiesForDiscoverStrip = fromMerged;
    }
  }

  return { syncedRows, feed, raceActivitiesForDiscoverStrip, usingLiveRacePreviewOnly };
}
