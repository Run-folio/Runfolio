import type { LinkedStravaActivitySnapshot } from "@/lib/linked-activity-snapshot";
import type { ActivityPortfolioStravaView } from "@/types";
import type { Race } from "@/types";
import {
  collectStravaActivityPhotoUrls,
  formatStravaMovingTime,
  formatDurationFromSeconds,
  type StravaActivityJson
} from "@/lib/strava-api";

function paceLabelFromMps(mps: number | null | undefined): string | null {
  if (mps == null || mps <= 0) return null;
  const secPerKm = 1000 / mps;
  const mins = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${mins}:${String(sec).padStart(2, "0")} /km`;
}

export function buildActivityPortfolioStravaView(
  stravaId: string,
  raw: StravaActivityJson
): ActivityPortfolioStravaView {
  const distKm = Math.round((raw.distance / 1000) * 100) / 100;
  const loc = [raw.location_city, raw.location_country].filter(Boolean).join(", ") || "—";
  const elev =
    raw.total_elevation_gain != null && Number.isFinite(raw.total_elevation_gain)
      ? Math.round(raw.total_elevation_gain)
      : null;
  const elapsedSec = raw.elapsed_time ?? raw.moving_time;
  return {
    strava_id: stravaId,
    name: raw.name,
    sport_type: raw.sport_type ?? null,
    type: raw.type ?? null,
    start_date: raw.start_date.slice(0, 10),
    location_label: loc,
    distance_km: distKm,
    moving_time_label: formatStravaMovingTime(raw.moving_time),
    elapsed_time_label: elapsedSec !== raw.moving_time ? formatDurationFromSeconds(elapsedSec) : null,
    pace_label: paceLabelFromMps(raw.average_speed),
    elevation_m: elev,
    kudos_count: raw.kudos_count ?? 0,
    achievement_count: raw.achievement_count ?? 0,
    description: raw.description ?? null,
    has_map: Boolean(raw.map?.summary_polyline),
    strava_url: `https://www.strava.com/activities/${stravaId}`,
    photo_urls: collectStravaActivityPhotoUrls(raw.photos)
  };
}

/** Persisted snapshot at link time — no Strava API. */
export function buildActivityPortfolioStravaViewFromSnapshot(
  snap: LinkedStravaActivitySnapshot
): ActivityPortfolioStravaView {
  const movSec = snap.moving_time_sec ?? 0;
  const movLabel =
    snap.moving_time_label?.trim() ||
    (movSec > 0 ? formatStravaMovingTime(movSec) : "—");
  const elapsedSec = snap.elapsed_time_sec ?? movSec;
  return {
    strava_id: snap.strava_activity_id,
    name: snap.activity_title,
    sport_type: snap.sport_type,
    type: snap.activity_type,
    start_date: snap.start_date.slice(0, 10),
    location_label: "—",
    distance_km: snap.distance_km,
    moving_time_label: movLabel,
    elapsed_time_label:
      elapsedSec > 0 && elapsedSec !== movSec ? formatDurationFromSeconds(elapsedSec) : null,
    pace_label: null,
    elevation_m: snap.elevation_m,
    kudos_count: 0,
    achievement_count: 0,
    description: snap.description ?? null,
    has_map: false,
    strava_url: snap.strava_url,
    photo_urls: []
  };
}

/** When live Strava fetch fails — hydrate from saved race row only. */
export function buildActivityPortfolioStravaViewFromRace(race: Race, stravaId: string): ActivityPortfolioStravaView {
  return {
    strava_id: stravaId,
    name: race.name,
    sport_type: null,
    type: null,
    start_date: race.date ?? "",
    location_label: race.location ?? "—",
    distance_km: Number(race.distance_km) || 0,
    moving_time_label: race.time ?? "—",
    elapsed_time_label: null,
    pace_label: null,
    elevation_m: race.elevation_m ?? null,
    kudos_count: 0,
    achievement_count: 0,
    description: race.description ?? null,
    has_map: false,
    strava_url: `https://www.strava.com/activities/${stravaId}`,
    photo_urls: []
  };
}
