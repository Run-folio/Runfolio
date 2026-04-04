import { formatStravaMovingTime } from "@/lib/strava-api";
import type { StravaFeedActivity } from "@/types";
import type { StravaSyncedActivityRow } from "@/lib/strava-sync/types";

/** Map a persisted sync row into the feed shape used by discover / portfolio strips. */
export function syncedRowToStravaFeedActivity(row: StravaSyncedActivityRow): StravaFeedActivity {
  const distKm = row.distance_km ?? 0;
  const distM = row.distance_m ?? Math.round(distKm * 1000);
  const mov = row.moving_time_sec ?? 0;
  const elap = row.elapsed_time_sec ?? mov;
  const source = row.activity_source ?? "strava";
  const stravaUrl =
    source === "strava"
      ? `https://www.strava.com/activities/${row.strava_activity_id}`
      : `/activities/${encodeURIComponent(row.strava_activity_id)}`;
  return {
    strava_id: row.strava_activity_id,
    activity_source: source,
    name: row.name,
    start_date: row.start_date,
    start_date_local: null,
    distance_m: distM,
    distance_km: distKm,
    moving_time_sec: mov,
    moving_time_label: formatStravaMovingTime(mov),
    elapsed_time_sec: elap,
    elevation_m: row.elevation_gain_m,
    sport_type: row.sport_type,
    type: row.activity_type,
    location_city: row.city,
    location_country: row.country,
    average_speed_mps: null,
    max_speed_mps: null,
    kudos_count: row.kudos_count ?? 0,
    achievement_count: row.achievement_count ?? 0,
    summary_polyline: row.polyline,
    strava_url: stravaUrl,
    primary_photo_url: null,
    description: row.description
  };
}
