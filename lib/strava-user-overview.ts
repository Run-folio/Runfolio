import type { SupabaseClient } from "@supabase/supabase-js";
import { getStravaFeed } from "@/lib/strava-feed";
import { listSyncedActivitiesForUser } from "@/lib/strava-sync/repository";
import { syncedRowToStravaFeedActivity } from "@/lib/strava-sync/synced-row-to-feed";
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

/**
 * Single load path for Overview + Match & Import: one list sync query and one Strava feed fetch,
 * plus a consistent choice of which activities power the long-run discover strip.
 */
export async function loadUserStravaOverviewState(
  supabase: SupabaseClient,
  userId: string
): Promise<UserStravaOverviewState> {
  const [syncedRows, feed] = await Promise.all([
    listSyncedActivitiesForUser(supabase, userId),
    getStravaFeed()
  ]);

  const persistedCandidates = syncedRows
    .filter((r) => r.potential_race_activity && !r.linked_portfolio_race_id)
    .map(syncedRowToStravaFeedActivity);

  const usingLiveRacePreviewOnly =
    persistedCandidates.length === 0 && feed.ok && feed.raceCandidates.length > 0;

  const raceActivitiesForDiscoverStrip =
    persistedCandidates.length > 0 ? persistedCandidates : feed.ok ? feed.raceCandidates : [];

  return { syncedRows, feed, raceActivitiesForDiscoverStrip, usingLiveRacePreviewOnly };
}
