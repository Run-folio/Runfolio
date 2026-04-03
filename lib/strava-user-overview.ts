import type { SupabaseClient } from "@supabase/supabase-js";
import { getStravaConnectionStubFeed } from "@/lib/strava-feed";
import {
  listDismissedCanonicalStravaIds,
  listSyncedActivitiesForUser
} from "@/lib/strava-sync/repository";
import { syncedRowToStravaFeedActivity } from "@/lib/strava-sync/synced-row-to-feed";
import { isSyncedRowRunLikeForMatchVisibility } from "@/lib/strava-race-candidates";
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
  if (row.manual_link_only) return false;
  if (row.linked_portfolio_race_id) return false;
  const st = row.match_hub_status?.trim();
  if (st === "not_race" || st === "snoozed") return false;
  if (dismissed.has(row.strava_activity_id)) return false;
  if (!row.potential_race_activity && !isSyncedRowRunLikeForMatchVisibility(row)) return false;
  return true;
}

/**
 * Overview + Match hub: load persisted Strava sync rows only. Strava API is not called here
 * (connection stub is used for OAuth messaging only).
 */
export async function loadUserStravaOverviewState(
  supabase: SupabaseClient,
  userId: string
): Promise<UserStravaOverviewState> {
  const [syncedRows, feed, dismissed] = await Promise.all([
    listSyncedActivitiesForUser(supabase, userId),
    getStravaConnectionStubFeed(),
    listDismissedCanonicalStravaIds(supabase, userId)
  ]);

  const raceActivitiesForDiscoverStrip: StravaFeedActivity[] = syncedRows
    .filter((r) => isOverviewStripSyncedRow(r, dismissed))
    .map(syncedRowToStravaFeedActivity);

  return {
    syncedRows,
    feed,
    raceActivitiesForDiscoverStrip,
    usingLiveRacePreviewOnly: false
  };
}
