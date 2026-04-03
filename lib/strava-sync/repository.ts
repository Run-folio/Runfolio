import "server-only";

import type { StravaSummaryActivityJson } from "@/lib/strava-api";
import { normalizeStravaSummary } from "@/lib/strava-feed";
import { computePotentialRaceActivity } from "@/lib/strava-sync/race-candidate-heuristics";
import { hashStravaSummaryPayload } from "@/lib/strava-sync/payload-hash";
import type { StravaSyncedActivityRow } from "@/lib/strava-sync/types";
import { createClient } from "@/lib/supabase/server";
import { collectStravaActivityPhotoUrls } from "@/lib/strava-api";
import { runfolioLog } from "@/lib/runfolio-log";
import type { SupabaseClient } from "@supabase/supabase-js";

const TABLE = "strava_synced_activities";

function photosFromSummary(raw: StravaSummaryActivityJson): string[] {
  return collectStravaActivityPhotoUrls(raw.photos ?? null);
}

export function summaryToUpsertRow(
  userId: string,
  raw: StravaSummaryActivityJson,
  now: string
): Record<string, unknown> {
  const norm = normalizeStravaSummary(raw);
  const potential = computePotentialRaceActivity(norm);
  const hash = hashStravaSummaryPayload(raw);
  const lat = raw.start_latlng;
  return {
    user_id: userId,
    strava_activity_id: String(raw.id),
    name: raw.name,
    description: raw.description?.trim() ?? null,
    distance_m: raw.distance,
    distance_km: norm.distance_km,
    elevation_gain_m: norm.elevation_m,
    moving_time_sec: raw.moving_time,
    elapsed_time_sec: raw.elapsed_time ?? raw.moving_time,
    start_date: raw.start_date,
    timezone: null,
    city: raw.location_city ?? null,
    country: raw.location_country ?? null,
    latitude: Array.isArray(lat) ? lat[0] ?? null : null,
    longitude: Array.isArray(lat) ? lat[1] ?? null : null,
    polyline: raw.map?.summary_polyline ?? null,
    photos: photosFromSummary(raw),
    sport_type: raw.sport_type ?? null,
    activity_type: raw.type ?? null,
    kudos_count: raw.kudos_count ?? 0,
    achievement_count: raw.achievement_count ?? 0,
    potential_race_activity: potential,
    payload_hash: hash,
    updated_at: now
  };
}

export type SyncSummary = { upserted: number; skippedUnchanged: number; errors: number };

export async function upsertStravaSummariesForUser(
  supabase: SupabaseClient,
  userId: string,
  summaries: StravaSummaryActivityJson[]
): Promise<SyncSummary> {
  const now = new Date().toISOString();
  let upserted = 0;
  let skippedUnchanged = 0;
  let errors = 0;

  for (const raw of summaries) {
    const hash = hashStravaSummaryPayload(raw);
    const sid = String(raw.id);
    const { data: existing } = await supabase
      .from(TABLE)
      .select("id, payload_hash")
      .eq("user_id", userId)
      .eq("strava_activity_id", sid)
      .maybeSingle();

    if (existing && (existing as { payload_hash?: string | null }).payload_hash === hash) {
      skippedUnchanged += 1;
      continue;
    }

    const row = summaryToUpsertRow(userId, raw, now);
    if (existing) {
      const { error } = await supabase.from(TABLE).update(row).eq("id", (existing as { id: string }).id);
      if (error) {
        errors += 1;
        runfolioLog.warn("stravaSync.update", error.message, {
          stravaId: sid,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
      } else {
        upserted += 1;
      }
    } else {
      const { error } = await supabase.from(TABLE).insert({ ...row, created_at: now });
      if (error) {
        errors += 1;
        runfolioLog.warn("stravaSync.insert", error.message, {
          stravaId: sid,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
      } else {
        upserted += 1;
      }
    }
  }

  return { upserted, skippedUnchanged, errors };
}

export async function listSyncedActivitiesForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<StravaSyncedActivityRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("start_date", { ascending: false });
   if (error) {
    runfolioLog.warn("stravaSync.list", error.message, {
      code: error.code,
      userId,
      details: error.details
    });
    return [];
  }
  return (data ?? []) as StravaSyncedActivityRow[];
}

export async function listProfileIncludedSyncedActivities(
  supabase: SupabaseClient,
  userId: string,
  limit = 12
): Promise<StravaSyncedActivityRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .eq("profile_include", true)
    .order("start_date", { ascending: false })
    .limit(limit);
  if (error) {
    runfolioLog.warn("stravaSync.profileInclude", error.message, { code: error.code, userId });
    return [];
  }
  return (data ?? []) as StravaSyncedActivityRow[];
}

export async function listDismissedCanonicalStravaIds(
  supabase: SupabaseClient,
  userId: string
): Promise<Set<string>> {
  const { data } = await supabase
    .from("strava_canonical_match_dismissals")
    .select("strava_activity_id")
    .eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.strava_activity_id as string));
}

export async function dismissCanonicalMatchSuggestion(
  supabase: SupabaseClient,
  userId: string,
  stravaActivityId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("strava_canonical_match_dismissals").upsert({
    user_id: userId,
    strava_activity_id: stravaActivityId,
    dismissed_at: new Date().toISOString()
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
