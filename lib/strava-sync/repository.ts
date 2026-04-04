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

function safeInt(n: unknown): number | null {
  if (n == null || n === "") return null;
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.round(v);
}

/** Ensures integer columns match Postgres `integer` and `name` / `start_date` satisfy NOT NULL. */
export function validateStravaSummaryForPersist(raw: StravaSummaryActivityJson): { ok: true } | { ok: false; reason: string } {
  if (raw.id == null || !Number.isFinite(Number(raw.id))) {
    return { ok: false, reason: "missing_activity_id" };
  }
  const start = raw.start_date?.trim();
  if (!start) {
    return { ok: false, reason: "missing_start_date" };
  }
  return { ok: true };
}

export function summaryToUpsertRow(
  userId: string,
  raw: StravaSummaryActivityJson,
  now: string,
  manualLinkOnly: boolean
): Record<string, unknown> {
  const norm = normalizeStravaSummary(raw);
  const potential = manualLinkOnly ? false : computePotentialRaceActivity(norm);
  const hash = hashStravaSummaryPayload(raw);
  const lat = raw.start_latlng;
  const nameTrim = raw.name != null ? String(raw.name).trim() : "";
  const moving = safeInt(raw.moving_time);
  const elapsed = safeInt(raw.elapsed_time ?? raw.moving_time);
  return {
    user_id: userId,
    activity_source: "strava",
    strava_activity_id: String(raw.id),
    name: nameTrim || "Strava activity",
    description: raw.description?.trim() ?? null,
    distance_m: raw.distance,
    distance_km: norm.distance_km,
    elevation_gain_m: norm.elevation_m,
    moving_time_sec: moving,
    elapsed_time_sec: elapsed ?? moving,
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
    kudos_count: safeInt(raw.kudos_count) ?? 0,
    achievement_count: safeInt(raw.achievement_count) ?? 0,
    potential_race_activity: potential,
    manual_link_only: manualLinkOnly,
    payload_hash: hash,
    updated_at: now
  };
}

export type SyncSummary = {
  upserted: number;
  skippedUnchanged: number;
  errors: number;
  /** Rows that passed the import filter but failed validation (never sent to the DB). */
  skippedInvalid: number;
  /** insert/update calls we attempted after dedupe (excludes skippedUnchanged and skippedInvalid). */
  writeAttempts: number;
};

/** RLS update policies compare `auth.uid()` to `user_id`; avoid PATCHing immutable identity columns. */
function rowPatchForStravaUpdate(row: Record<string, unknown>): Record<string, unknown> {
  const { user_id: _uid, strava_activity_id: _sid, ...rest } = row;
  void _uid;
  void _sid;
  return rest;
}

function countInvalidSummaries(summaries: Array<{ raw: StravaSummaryActivityJson }>): number {
  let n = 0;
  for (const { raw } of summaries) {
    if (!validateStravaSummaryForPersist(raw).ok) n += 1;
  }
  return n;
}

export async function getLatestSyncedStartDateIso(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from(TABLE)
    .select("start_date")
    .eq("user_id", userId)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const d = (data as { start_date?: string } | null)?.start_date;
  return d?.trim() ? d : null;
}

export async function upsertStravaSummariesForUser(
  supabase: SupabaseClient,
  userId: string,
  summaries: Array<{ raw: StravaSummaryActivityJson; manualLinkOnly: boolean }>
): Promise<SyncSummary> {
  const now = new Date().toISOString();
  let upserted = 0;
  let skippedUnchanged = 0;
  let errors = 0;
  let skippedInvalid = 0;
  let writeAttempts = 0;

  const preInvalid = countInvalidSummaries(summaries);
  const { data: authUserResult, error: authReadError } = await supabase.auth.getUser();
  const jwtUserId = authUserResult?.user?.id ?? null;

  if (authReadError || !jwtUserId) {
    runfolioLog.warn("stravaSync.persist", "abort_no_auth_session", {
      paramUserId: userId,
      authMessage: authReadError?.message ?? "no_user",
      hint: "Supabase client has no JWT — RLS will block writes. Confirm cookies reach server actions and middleware refresh runs."
    });
    return {
      upserted: 0,
      skippedUnchanged: 0,
      errors: Math.max(0, summaries.length - preInvalid),
      skippedInvalid: preInvalid,
      writeAttempts: 0
    };
  }

  if (jwtUserId !== userId) {
    runfolioLog.warn("stravaSync.persist", "abort_jwt_user_mismatch", {
      paramUserId: userId,
      jwtUserId,
      hint: "Caller user id does not match signed-in user — refusing writes."
    });
    return {
      upserted: 0,
      skippedUnchanged: 0,
      errors: Math.max(0, summaries.length - preInvalid),
      skippedInvalid: preInvalid,
      writeAttempts: 0
    };
  }

  for (const { raw, manualLinkOnly } of summaries) {
    const hash = hashStravaSummaryPayload(raw);
    const sid = String(raw.id);

    const validated = validateStravaSummaryForPersist(raw);
    if (!validated.ok) {
      skippedInvalid += 1;
      runfolioLog.warn("stravaSync.persist", "skipped_invalid_payload", {
        userId,
        stravaActivityId: sid,
        reason: validated.reason
      });
      continue;
    }

    const { data: existing, error: selectExistingError } = await supabase
      .from(TABLE)
      .select("id, payload_hash, manual_link_only")
      .eq("user_id", userId)
      .eq("strava_activity_id", sid)
      .maybeSingle();

    if (selectExistingError) {
      errors += 1;
      runfolioLog.warn("stravaSync.persist", "select_existing_failed", {
        stravaActivityId: sid,
        paramUserId: userId,
        jwtUserId,
        message: selectExistingError.message,
        code: selectExistingError.code,
        details: selectExistingError.details,
        hint: selectExistingError.hint
      });
      continue;
    }

    const ex = existing as { id?: string; payload_hash?: string | null; manual_link_only?: boolean } | null;
    if (ex?.payload_hash === hash && Boolean(ex.manual_link_only) === manualLinkOnly) {
      skippedUnchanged += 1;
      continue;
    }

    const row = summaryToUpsertRow(userId, raw, now, manualLinkOnly) as Record<string, unknown>;
    const writePreview = {
      param_user_id: userId,
      jwt_user_id: jwtUserId,
      strava_activity_id: sid,
      start_date: String(row.start_date ?? ""),
      distance_m: row.distance_m as number | null | undefined,
      distance_km: row.distance_km as number | null | undefined,
      sport_type: row.sport_type != null ? String(row.sport_type) : null,
      activity_type: row.activity_type != null ? String(row.activity_type) : null,
      manual_link_only: manualLinkOnly,
      op: existing ? ("update" as const) : ("insert" as const),
      existing_row_id: existing ? String((existing as { id: string }).id) : null
    };

    runfolioLog.info("stravaSync.persist", "write_payload_preview", writePreview);
    writeAttempts += 1;

    if (existing) {
      const updatePatch = rowPatchForStravaUpdate(row);
      const { data: updatedRows, error } = await supabase
        .from(TABLE)
        .update(updatePatch)
        .eq("user_id", userId)
        .eq("strava_activity_id", sid)
        .select("id");
      if (error) {
        errors += 1;
        runfolioLog.warn("stravaSync.persist", "update_failed", {
          stravaId: sid,
          paramUserId: userId,
          jwtUserId,
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
      } else if (!updatedRows?.length) {
        runfolioLog.warn("stravaSync.persist", "update_zero_rows", {
          stravaId: sid,
          paramUserId: userId,
          jwtUserId,
          hint: "UPDATE matched 0 rows with user_id+strava_activity_id filter — retrying INSERT (e.g. stale id or RLS quirk)."
        });
        const { data: insertedRows, error: insErr } = await supabase
          .from(TABLE)
          .insert({ ...row, created_at: now })
          .select("id");
        if (insErr) {
          errors += 1;
          runfolioLog.warn("stravaSync.persist", "insert_after_update_zero_failed", {
            stravaId: sid,
            message: insErr.message,
            code: insErr.code,
            details: insErr.details,
            hint: insErr.hint
          });
        } else if (!insertedRows?.length) {
          errors += 1;
          runfolioLog.warn("stravaSync.persist", "insert_after_update_zero_empty", { stravaId: sid });
        } else {
          upserted += 1;
          runfolioLog.info("stravaSync.persist", "insert_ok_after_update_zero", {
            stravaId: sid,
            rowId: insertedRows[0]?.id,
            rowsReturned: insertedRows.length
          });
        }
      } else {
        upserted += 1;
        runfolioLog.info("stravaSync.persist", "update_ok", {
          stravaId: sid,
          rowId: updatedRows[0]?.id,
          rowsReturned: updatedRows.length
        });
      }
    } else {
      const { data: insertedRows, error } = await supabase
        .from(TABLE)
        .insert({ ...row, created_at: now })
        .select("id");
      if (error) {
        errors += 1;
        runfolioLog.warn("stravaSync.persist", "insert_failed", {
          stravaId: sid,
          paramUserId: userId,
          jwtUserId,
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
      } else if (!insertedRows?.length) {
        errors += 1;
        runfolioLog.warn("stravaSync.persist", "insert_zero_rows", {
          stravaId: sid,
          hint: "Insert returned no row — unexpected with returning select"
        });
      } else {
        upserted += 1;
        runfolioLog.info("stravaSync.persist", "insert_ok", {
          stravaId: sid,
          rowId: insertedRows[0]?.id,
          rowsReturned: insertedRows.length
        });
      }
    }
  }

  if (summaries.length > 0) {
    runfolioLog.info("stravaSync.persist", "batch_summary", {
      paramUserId: userId,
      jwtUserId,
      inputCount: summaries.length,
      upserted,
      skippedUnchanged,
      skippedInvalid,
      errors,
      writeAttempts
    });
  }

  return { upserted, skippedUnchanged, errors, skippedInvalid, writeAttempts };
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
