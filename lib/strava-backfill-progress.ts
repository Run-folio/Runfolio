import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  coerceStravaRateLimitUxKind,
  deriveBackfillUxPhase,
  type StravaBackfillProgress
} from "@/lib/strava-backfill-model";
import { getIngestState, getStravaIngestStateTableStatus } from "@/lib/strava-sync/ingest-state";

export type { StravaBackfillProgress, StravaBackfillUxPhase } from "@/lib/strava-backfill-model";

export async function loadStravaBackfillProgress(
  supabase: SupabaseClient,
  userId: string
): Promise<StravaBackfillProgress> {
  const [tableStatus, countRes] = await Promise.all([
    getStravaIngestStateTableStatus(supabase),
    supabase
      .from("strava_synced_activities")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
  ]);

  const syncedActivityCount = countRes.count ?? 0;

  if (!tableStatus.ok) {
    return {
      phase: "needs_attention",
      syncedActivityCount,
      backfillBatchesCompleted: 0,
      backfillBeforeEpoch: null,
      backfillExhausted: false,
      moreHistoryAvailable: true,
      lastBackfillAt: null,
      lastRateLimitAt: null,
      lastError: tableStatus.message,
      stravaRateLimitKind: null,
      stravaRateLimitUntil: null,
      updatedAt: null,
      ingestStateTableAvailable: false
    };
  }

  const state = await getIngestState(supabase, userId);
  const phase = deriveBackfillUxPhase(state, syncedActivityCount);
  const exhausted = state?.backfill_exhausted ?? false;

  return {
    phase,
    syncedActivityCount,
    backfillBatchesCompleted: state?.backfill_batches_completed ?? 0,
    backfillBeforeEpoch: state?.backfill_before_epoch ?? null,
    backfillExhausted: exhausted,
    moreHistoryAvailable: !exhausted,
    lastBackfillAt: state?.last_backfill_at ?? null,
    lastRateLimitAt: state?.last_rate_limit_at ?? null,
    lastError: state?.last_error ?? null,
    stravaRateLimitKind: coerceStravaRateLimitUxKind(state?.strava_rate_limit_kind ?? null),
    stravaRateLimitUntil: state?.strava_rate_limit_until ?? null,
    updatedAt: state?.updated_at ?? null,
    ingestStateTableAvailable: true
  };
}
