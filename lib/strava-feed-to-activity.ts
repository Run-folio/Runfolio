import type { Activity, StravaFeedActivity } from "@/types";

/** Map feed row to `Activity` for Create Race autofill (client-safe ids). */
export function stravaFeedToActivity(feed: StravaFeedActivity, userId = "strava-feed"): Activity {
  return {
    id: `prefill-${feed.strava_id}`,
    user_id: userId,
    strava_id: feed.strava_id,
    name: feed.name,
    distance_km: feed.distance_km,
    moving_time: feed.moving_time_label,
    date: feed.start_date.slice(0, 10),
    start_lat: null,
    start_lng: null,
    polyline: feed.summary_polyline,
    description: feed.description?.trim() ? feed.description.trim() : null,
    created_at: new Date().toISOString(),
    elevation_m: feed.elevation_m,
    primary_photo_url: feed.primary_photo_url ?? undefined
  };
}
