import type { DiscoverStravaActivityCandidate } from "@/types";

export function buildStravaDiscoverConfirmFormData(
  discoverRaceId: string,
  candidate: DiscoverStravaActivityCandidate,
  bucketFutureRaceId: string | null,
  returnTo: string,
  fallbackLocation: string
): FormData {
  const fd = new FormData();
  fd.set("discover_race_id", discoverRaceId);
  fd.set("strava_activity_id", candidate.strava_id);
  fd.set("activity_title", candidate.name);
  if (candidate.moving_time_sec != null && Number.isFinite(candidate.moving_time_sec)) {
    fd.set("moving_time_sec", String(candidate.moving_time_sec));
  }
  if (bucketFutureRaceId) fd.set("target_user_race_id", bucketFutureRaceId);
  fd.set("date", candidate.date);
  fd.set("distance_km", String(candidate.distance_km));
  fd.set("elevation_m", candidate.elevation_m != null ? String(candidate.elevation_m) : "");
  fd.set("time", candidate.moving_time_label);
  const loc = candidate.location_label.trim();
  fd.set("location", loc && loc !== "—" ? loc : fallbackLocation);
  fd.set("description", "");
  fd.set("return_to", returnTo);
  return fd;
}

export function buildManualBucketCompleteFormData(
  userRaceId: string,
  candidate: DiscoverStravaActivityCandidate,
  returnTo: string,
  fallbackLocation: string
): FormData {
  const fd = new FormData();
  fd.set("user_race_id", userRaceId);
  fd.set("strava_activity_id", candidate.strava_id);
  fd.set("activity_title", candidate.name);
  if (candidate.moving_time_sec != null && Number.isFinite(candidate.moving_time_sec)) {
    fd.set("moving_time_sec", String(candidate.moving_time_sec));
  }
  fd.set("date", candidate.date);
  fd.set("distance_km", String(candidate.distance_km));
  fd.set("elevation_m", candidate.elevation_m != null ? String(candidate.elevation_m) : "");
  fd.set("time", candidate.moving_time_label);
  const loc = candidate.location_label.trim();
  fd.set("location", loc && loc !== "—" ? loc : fallbackLocation);
  fd.set("description", "");
  fd.set("return_to", returnTo);
  return fd;
}
