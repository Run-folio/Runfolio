import type { StravaFeedActivity } from "@/types";
import type { StravaSyncedActivityRow } from "@/lib/strava-sync/types";
import { syncedRowToStravaFeedActivity } from "@/lib/strava-sync/synced-row-to-feed";

function mergeRicher(a: StravaFeedActivity, b: StravaFeedActivity): StravaFeedActivity {
  return {
    ...a,
    primary_photo_url: b.primary_photo_url ?? a.primary_photo_url,
    description: a.description?.trim() ? a.description : b.description,
    elevation_m: a.elevation_m ?? b.elevation_m,
    location_city: a.location_city ?? b.location_city,
    location_country: a.location_country ?? b.location_country,
    moving_time_label: a.moving_time_label?.trim() ? a.moving_time_label : b.moving_time_label
  };
}

/**
 * Full manual-link candidate pool: every synced activity plus API results, deduped by Strava id.
 * Prefers the feed copy when merging so photos / fresh fields win; fills gaps from DB when offline/partial fetch.
 */
export function mergeStravaFeedActivitiesWithSynced(
  feedActivities: StravaFeedActivity[],
  syncedRows: StravaSyncedActivityRow[]
): StravaFeedActivity[] {
  const map = new Map<string, StravaFeedActivity>();
  for (const row of syncedRows) {
    const id = row.strava_activity_id?.trim();
    if (!id) continue;
    map.set(id, syncedRowToStravaFeedActivity(row));
  }
  for (const a of feedActivities) {
    const id = a.strava_id?.trim();
    if (!id) continue;
    const existing = map.get(id);
    if (!existing) {
      map.set(id, a);
      continue;
    }
    const apiFirst = mergeRicher(a, existing);
    map.set(id, apiFirst);
  }
  return [...map.values()].sort((x, y) => y.start_date.localeCompare(x.start_date));
}
