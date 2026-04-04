import { formatStravaMovingTime } from "@/lib/strava-api";
import type { ActivityIngestSource, StravaSyncedActivityRow } from "@/lib/strava-sync/types";

/** Persisted at Strava↔race link time; renders portfolio without live Strava API. */
export type LinkedStravaActivitySnapshot = {
  strava_activity_id: string;
  activity_source?: ActivityIngestSource;
  activity_title: string;
  start_date: string;
  distance_km: number;
  elevation_m: number | null;
  moving_time_sec: number | null;
  elapsed_time_sec: number | null;
  moving_time_label: string | null;
  sport_type: string | null;
  activity_type: string | null;
  strava_url: string;
  captured_at: string;
  discover_race_id?: string | null;
  canonical_race_id?: string | null;
  description?: string | null;
};

export function snapshotFromSyncedRow(
  row: StravaSyncedActivityRow,
  meta: { discover_race_id?: string | null; canonical_race_id?: string | null }
): LinkedStravaActivitySnapshot {
  const sid = row.strava_activity_id;
  const mov = row.moving_time_sec ?? 0;
  const src = row.activity_source ?? "strava";
  return {
    strava_activity_id: sid,
    activity_source: src,
    activity_title: row.name,
    start_date: row.start_date.slice(0, 10),
    distance_km: row.distance_km ?? 0,
    elevation_m: row.elevation_gain_m ?? null,
    moving_time_sec: row.moving_time_sec ?? null,
    elapsed_time_sec: row.elapsed_time_sec ?? null,
    moving_time_label: mov > 0 ? formatStravaMovingTime(mov) : null,
    sport_type: row.sport_type ?? null,
    activity_type: row.activity_type ?? null,
    strava_url: src === "strava" ? `https://www.strava.com/activities/${sid}` : "",
    captured_at: new Date().toISOString(),
    discover_race_id: meta.discover_race_id ?? null,
    canonical_race_id: meta.canonical_race_id ?? null,
    description: row.description?.trim() ? row.description : null
  };
}

export function snapshotFromRaceLinkFields(opts: {
  stravaActivityId: string;
  activityTitle: string;
  startDateYmd: string;
  distanceKm: number;
  elevationM: number | null;
  movingTimeSec?: number | null;
  elapsedTimeSec?: number | null;
  movingTimeLabel?: string | null;
  sportType?: string | null;
  activityType?: string | null;
  description?: string | null;
  discoverRaceId?: string | null;
  canonicalRaceId?: string | null;
}): LinkedStravaActivitySnapshot {
  const sid = opts.stravaActivityId;
  return {
    strava_activity_id: sid,
    activity_source: "strava",
    activity_title: opts.activityTitle,
    start_date: opts.startDateYmd.slice(0, 10),
    distance_km: opts.distanceKm,
    elevation_m: opts.elevationM,
    moving_time_sec: opts.movingTimeSec ?? null,
    elapsed_time_sec: opts.elapsedTimeSec ?? null,
    moving_time_label: opts.movingTimeLabel ?? null,
    sport_type: opts.sportType ?? null,
    activity_type: opts.activityType ?? null,
    strava_url: `https://www.strava.com/activities/${sid}`,
    captured_at: new Date().toISOString(),
    discover_race_id: opts.discoverRaceId ?? null,
    canonical_race_id: opts.canonicalRaceId ?? null,
    description: opts.description?.trim() ? opts.description : null
  };
}
