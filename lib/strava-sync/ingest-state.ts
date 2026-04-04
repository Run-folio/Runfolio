import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { runfolioLog } from "@/lib/runfolio-log";

/** Table created by `supabase/migration_strava_ingest_state.sql`. Required for backfill cursors + incremental high-water. */
export const STRAVA_INGEST_STATE_TABLE = "user_strava_ingest_state";

export const STRAVA_INGEST_STATE_MIGRATION = "migration_strava_ingest_state.sql";
export const STRAVA_RATE_LIMIT_META_MIGRATION = "migration_strava_rate_limit_meta.sql";
export const STRAVA_FIRST_BACKFILL_THROTTLE_MIGRATION = "migration_strava_first_backfill_throttle.sql";

const TABLE = STRAVA_INGEST_STATE_TABLE;

export function stravaIngestStateSetupUserMessage(): string {
  return `Database table ${STRAVA_INGEST_STATE_TABLE} is missing or unreachable. Apply supabase/${STRAVA_INGEST_STATE_MIGRATION} (see supabase/MIGRATION_ORDER.txt), redeploy the schema cache if needed, then try again. Without it, Strava backfill and incremental sync cannot save cursors.`;
}

/** PostgREST / Postgres signals that the ingest-state relation is absent. */
export function isStravaIngestStateSchemaMissingError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = String(error.code ?? "");
  const msg = (error.message ?? "").toLowerCase();
  if (code === "PGRST205" || code === "42P01") return true;
  if (msg.includes("user_strava_ingest_state") && (msg.includes("does not exist") || msg.includes("could not find the table"))) {
    return true;
  }
  return false;
}

/**
 * Returns whether the ingest-state table is reachable with the current Supabase session (RLS).
 * Call before backfill / incremental sync; avoids silent cursor loss when the migration was never applied.
 */
export async function getStravaIngestStateTableStatus(
  supabase: SupabaseClient
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from(TABLE).select("user_id").limit(1);
  if (!error) return { ok: true };
  if (isStravaIngestStateSchemaMissingError(error)) {
    runfolioLog.warn("strava.ingestState.schema", "ingest state table missing", { code: error.code });
    return { ok: false, message: stravaIngestStateSetupUserMessage() };
  }
  runfolioLog.warn("strava.ingestState.probe", error.message, { code: error.code });
  return {
    ok: false,
    message: `Could not read ${TABLE}: ${error.message}. Strava backfill and incremental sync need this table and RLS access.`
  };
}

export type UserStravaIngestState = {
  user_id: string;
  incremental_high_water_epoch: number | null;
  last_incremental_at: string | null;
  backfill_before_epoch: number | null;
  backfill_exhausted: boolean;
  last_backfill_at: string | null;
  backfill_batches_completed: number;
  last_rate_limit_at: string | null;
  last_error: string | null;
  /** From migration_strava_rate_limit_meta.sql — optional until applied. */
  strava_rate_limit_kind?: string | null;
  strava_rate_limit_until?: string | null;
  /** From migration_strava_first_backfill_throttle.sql — optional until applied. */
  first_backfill_last_attempt_at?: string | null;
  updated_at: string;
};

export async function getIngestState(
  supabase: SupabaseClient,
  userId: string
): Promise<UserStravaIngestState | null> {
  const { data, error } = await supabase.from(TABLE).select("*").eq("user_id", userId).maybeSingle();
  if (error) {
    if (isStravaIngestStateSchemaMissingError(error)) {
      runfolioLog.warn("strava.ingestState.read", "ingest state table missing", { userId, code: error.code });
    } else {
      runfolioLog.warn("strava.ingestState.read", error.message, { userId, code: error.code });
    }
    return null;
  }
  return data as UserStravaIngestState | null;
}

function isoNow(): string {
  return new Date().toISOString();
}

export function maxStartEpochFromSummaries(summaries: { start_date: string }[]): number | null {
  let maxMs = 0;
  for (const s of summaries) {
    const ms = Date.parse(s.start_date);
    if (Number.isFinite(ms) && ms > maxMs) maxMs = ms;
  }
  return maxMs > 0 ? Math.floor(maxMs / 1000) : null;
}

export function minStartEpochFromSummaries(summaries: { start_date: string }[]): number | null {
  let minMs = Number.POSITIVE_INFINITY;
  for (const s of summaries) {
    const ms = Date.parse(s.start_date);
    if (Number.isFinite(ms) && ms < minMs) minMs = ms;
  }
  return Number.isFinite(minMs) ? Math.floor(minMs / 1000) : null;
}

/** Seconds remaining before another first-batch backfill may start (0 = allowed). */
export function firstBackfillCooldownRemainingSec(
  state: UserStravaIngestState | null,
  cooldownSec: number
): number {
  const raw = state?.first_backfill_last_attempt_at;
  if (!raw?.trim()) return 0;
  const elapsed = (Date.now() - Date.parse(raw)) / 1000;
  if (!Number.isFinite(elapsed)) return 0;
  return Math.max(0, Math.ceil(cooldownSec - elapsed));
}

/** Record that the user started a first-batch backfill attempt (after cooldown check passes). */
export async function markFirstBackfillAttemptNow(supabase: SupabaseClient, userId: string): Promise<void> {
  const existing = await getIngestState(supabase, userId);
  const now = isoNow();
  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: userId,
      incremental_high_water_epoch: existing?.incremental_high_water_epoch ?? null,
      last_incremental_at: existing?.last_incremental_at ?? null,
      backfill_before_epoch: existing?.backfill_before_epoch ?? null,
      backfill_exhausted: existing?.backfill_exhausted ?? false,
      backfill_batches_completed: existing?.backfill_batches_completed ?? 0,
      last_backfill_at: existing?.last_backfill_at ?? null,
      last_rate_limit_at: existing?.last_rate_limit_at ?? null,
      last_error: existing?.last_error ?? null,
      strava_rate_limit_kind: existing?.strava_rate_limit_kind ?? null,
      strava_rate_limit_until: existing?.strava_rate_limit_until ?? null,
      first_backfill_last_attempt_at: now,
      updated_at: now
    },
    { onConflict: "user_id" }
  );
  if (error) runfolioLog.warn("strava.ingestState.firstBackfillAttempt", error.message, { userId });
}

export async function touchIncrementalSyncOnly(supabase: SupabaseClient, userId: string): Promise<void> {
  const existing = await getIngestState(supabase, userId);
  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: userId,
      incremental_high_water_epoch: existing?.incremental_high_water_epoch ?? null,
      last_incremental_at: isoNow(),
      backfill_before_epoch: existing?.backfill_before_epoch ?? null,
      backfill_exhausted: existing?.backfill_exhausted ?? false,
      backfill_batches_completed: existing?.backfill_batches_completed ?? 0,
      last_backfill_at: existing?.last_backfill_at ?? null,
      last_rate_limit_at: existing?.last_rate_limit_at ?? null,
      last_error: null,
      strava_rate_limit_kind: null,
      strava_rate_limit_until: null,
      first_backfill_last_attempt_at: existing?.first_backfill_last_attempt_at ?? null,
      updated_at: isoNow()
    },
    { onConflict: "user_id" }
  );
  if (error) runfolioLog.warn("strava.ingestState.touchIncremental", error.message, { userId });
}

export async function upsertIngestStateIncremental(
  supabase: SupabaseClient,
  userId: string,
  highWaterEpoch: number
): Promise<void> {
  const existing = await getIngestState(supabase, userId);
  const next = Math.max(existing?.incremental_high_water_epoch ?? 0, highWaterEpoch);
  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: userId,
      incremental_high_water_epoch: next,
      last_incremental_at: isoNow(),
      backfill_before_epoch: existing?.backfill_before_epoch ?? null,
      backfill_exhausted: existing?.backfill_exhausted ?? false,
      backfill_batches_completed: existing?.backfill_batches_completed ?? 0,
      last_backfill_at: existing?.last_backfill_at ?? null,
      last_rate_limit_at: existing?.last_rate_limit_at ?? null,
      last_error: null,
      strava_rate_limit_kind: null,
      strava_rate_limit_until: null,
      first_backfill_last_attempt_at: existing?.first_backfill_last_attempt_at ?? null,
      updated_at: isoNow()
    },
    { onConflict: "user_id" }
  );
  if (error) runfolioLog.warn("strava.ingestState.incremental", error.message, { userId });
}

export async function upsertIngestStateBackfill(
  supabase: SupabaseClient,
  userId: string,
  patch: {
    nextBeforeEpoch: number | null;
    exhausted: boolean;
    alsoBumpIncrementalEpoch?: number | null;
  }
): Promise<void> {
  const existing = await getIngestState(supabase, userId);
  const batches = (existing?.backfill_batches_completed ?? 0) + 1;
  const incHigh =
    patch.alsoBumpIncrementalEpoch != null
      ? Math.max(existing?.incremental_high_water_epoch ?? 0, patch.alsoBumpIncrementalEpoch)
      : existing?.incremental_high_water_epoch ?? null;

  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: userId,
      incremental_high_water_epoch: incHigh,
      last_incremental_at: existing?.last_incremental_at ?? null,
      backfill_before_epoch: patch.nextBeforeEpoch,
      backfill_exhausted: patch.exhausted,
      backfill_batches_completed: batches,
      last_backfill_at: isoNow(),
      last_rate_limit_at: existing?.last_rate_limit_at ?? null,
      last_error: null,
      strava_rate_limit_kind: null,
      strava_rate_limit_until: null,
      first_backfill_last_attempt_at: existing?.first_backfill_last_attempt_at ?? null,
      updated_at: isoNow()
    },
    { onConflict: "user_id" }
  );
  if (error) runfolioLog.warn("strava.ingestState.backfill", error.message, { userId });
}

export async function recordIngestError(supabase: SupabaseClient, userId: string, message: string): Promise<void> {
  const existing = await getIngestState(supabase, userId);
  await supabase.from(TABLE).upsert(
    {
      user_id: userId,
      incremental_high_water_epoch: existing?.incremental_high_water_epoch ?? null,
      last_incremental_at: existing?.last_incremental_at ?? null,
      backfill_before_epoch: existing?.backfill_before_epoch ?? null,
      backfill_exhausted: existing?.backfill_exhausted ?? false,
      backfill_batches_completed: existing?.backfill_batches_completed ?? 0,
      last_backfill_at: existing?.last_backfill_at ?? null,
      last_rate_limit_at: existing?.last_rate_limit_at ?? null,
      last_error: message.slice(0, 2000),
      strava_rate_limit_kind: null,
      strava_rate_limit_until: null,
      first_backfill_last_attempt_at: existing?.first_backfill_last_attempt_at ?? null,
      updated_at: isoNow()
    },
    { onConflict: "user_id" }
  );
}

export type StravaRateLimitPersistKind = "short_window" | "daily" | "unknown";

export async function recordRateLimitHint(
  supabase: SupabaseClient,
  userId: string,
  detail?: string | null,
  opts?: {
    kind?: StravaRateLimitPersistKind;
    untilIso?: string | null;
  }
): Promise<void> {
  const existing = await getIngestState(supabase, userId);
  const lastError =
    detail?.trim() ? detail.trim().slice(0, 2000) : (existing?.last_error ?? null);
  const kind = opts?.kind ?? null;
  const untilIso = opts?.untilIso?.trim() ? opts.untilIso.trim() : null;
  await supabase.from(TABLE).upsert(
    {
      user_id: userId,
      incremental_high_water_epoch: existing?.incremental_high_water_epoch ?? null,
      last_incremental_at: existing?.last_incremental_at ?? null,
      backfill_before_epoch: existing?.backfill_before_epoch ?? null,
      backfill_exhausted: existing?.backfill_exhausted ?? false,
      backfill_batches_completed: existing?.backfill_batches_completed ?? 0,
      last_backfill_at: existing?.last_backfill_at ?? null,
      last_rate_limit_at: isoNow(),
      last_error: lastError,
      strava_rate_limit_kind: kind,
      strava_rate_limit_until: untilIso,
      first_backfill_last_attempt_at: existing?.first_backfill_last_attempt_at ?? null,
      updated_at: isoNow()
    },
    { onConflict: "user_id" }
  );
}
