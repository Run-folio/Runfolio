import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityIngestSource } from "@/lib/strava-sync/types";
import { computePotentialRaceActivity } from "@/lib/strava-sync/race-candidate-heuristics";
import { runfolioLog } from "@/lib/runfolio-log";
import { formatStravaMovingTime } from "@/lib/strava-api";
import type { StravaFeedActivity } from "@/types";
import type { NormalizedFileActivity } from "@/lib/activity-file-import/types";
import { fileActivityIdFromHash } from "@/lib/activity-route-id";

const TABLE = "strava_synced_activities";

export type PersistFileActivityResult =
  | { ok: true; strava_activity_id: string }
  | { ok: false; code: "duplicate" | "db" | "weak_data"; message: string };

function buildDescription(base: string | null, warnings: string[]): string | null {
  const w = warnings.filter(Boolean);
  if (!base?.trim() && w.length === 0) return null;
  const parts: string[] = [];
  if (base?.trim()) parts.push(base.trim());
  if (w.length) parts.push(`[Import notes] ${w.join(" ")}`);
  return parts.join("\n\n") || null;
}

export async function persistImportedFileActivity(opts: {
  supabase: SupabaseClient;
  userId: string;
  normalized: NormalizedFileActivity;
  activitySource: ActivityIngestSource;
  fileHashHex: string;
  warnings: string[];
}): Promise<PersistFileActivityResult> {
  const { supabase, userId, normalized, activitySource, fileHashHex, warnings } = opts;
  const strava_activity_id = fileActivityIdFromHash(fileHashHex);

  if (!Number.isFinite(normalized.distanceM) || normalized.distanceM < 5) {
    return {
      ok: false,
      code: "weak_data",
      message: "Could not read a plausible distance from this file (need at least a few meters)."
    };
  }

  const { data: dup } = await supabase
    .from(TABLE)
    .select("id")
    .eq("user_id", userId)
    .eq("strava_activity_id", strava_activity_id)
    .maybeSingle();
  if (dup) {
    return {
      ok: false,
      code: "duplicate",
      message: "This exact file was already imported. Open My Races or your activity list to find it."
    };
  }

  const distanceKm = Math.round((normalized.distanceM / 1000) * 100) / 100;
  const feedProbe: StravaFeedActivity = {
    strava_id: strava_activity_id,
    name: normalized.name,
    start_date: normalized.startDateIso,
    start_date_local: null,
    distance_m: normalized.distanceM,
    distance_km: distanceKm,
    moving_time_sec: Math.max(0, Math.round(normalized.movingTimeSec)),
    moving_time_label: formatStravaMovingTime(Math.max(0, Math.round(normalized.movingTimeSec))),
    elapsed_time_sec: Math.max(0, Math.round(normalized.elapsedTimeSec)),
    elevation_m: normalized.elevationGainM,
    sport_type: normalized.sportType,
    type: normalized.activityType,
    location_city: null,
    location_country: null,
    average_speed_mps: null,
    max_speed_mps: null,
    kudos_count: 0,
    achievement_count: 0,
    summary_polyline: normalized.polyline,
    strava_url: "",
    primary_photo_url: null,
    description: null,
    activity_source: activitySource
  };

  const potential = computePotentialRaceActivity(feedProbe);
  const now = new Date().toISOString();
  const description = buildDescription(normalized.description, warnings);

  const row = {
    user_id: userId,
    strava_activity_id,
    activity_source: activitySource,
    name: normalized.name.slice(0, 500),
    description,
    distance_m: normalized.distanceM,
    distance_km: distanceKm,
    elevation_gain_m: normalized.elevationGainM,
    moving_time_sec: Math.max(0, Math.round(normalized.movingTimeSec)),
    elapsed_time_sec: Math.max(0, Math.round(normalized.elapsedTimeSec)),
    start_date: normalized.startDateIso,
    timezone: null,
    city: null,
    country: null,
    latitude: normalized.startLat,
    longitude: normalized.startLng,
    polyline: normalized.polyline,
    photos: [],
    sport_type: normalized.sportType,
    activity_type: normalized.activityType,
    kudos_count: 0,
    achievement_count: 0,
    potential_race_activity: potential,
    manual_link_only: false,
    strava_updated_at: null,
    payload_hash: fileHashHex,
    updated_at: now,
    created_at: now
  };

  const { error } = await supabase.from(TABLE).insert(row);
  if (error) {
    runfolioLog.warn("fileImport.insert", error.message, { code: error.code });
    if (error.code === "23505") {
      return { ok: false, code: "duplicate", message: "This activity is already saved." };
    }
    return { ok: false, code: "db", message: error.message };
  }

  return { ok: true, strava_activity_id };
}
