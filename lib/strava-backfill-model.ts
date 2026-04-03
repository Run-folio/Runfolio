const RATE_LIMIT_RECENCY_MS = 20 * 60 * 1000;
const ERROR_BLOCK_RECENCY_MS = 2 * 60 * 60 * 1000;

export type StravaBackfillUxPhase =
  | "ready"
  | "partial"
  | "complete"
  | "no_matches"
  | "rate_limited"
  | "needs_attention";

/** Subset of ingest row used for backfill UX (no server-only import). */
export type StravaIngestStateForBackfill = {
  backfill_batches_completed: number;
  backfill_exhausted: boolean;
  last_rate_limit_at: string | null;
  last_error: string | null;
  updated_at: string;
};

export type StravaBackfillProgress = {
  phase: StravaBackfillUxPhase;
  syncedActivityCount: number;
  backfillBatchesCompleted: number;
  backfillExhausted: boolean;
  moreHistoryAvailable: boolean;
  lastBackfillAt: string | null;
  lastRateLimitAt: string | null;
  lastError: string | null;
  updatedAt: string | null;
  /**
   * False when `user_strava_ingest_state` is missing or unreadable (migration not applied or RLS).
   * Progress counts remain from `strava_synced_activities`; phases fall back to needs_attention with `lastError`.
   */
  ingestStateTableAvailable: boolean;
};

function isRecent(ts: string | null, windowMs: number): boolean {
  if (!ts?.trim()) return false;
  const ms = Date.parse(ts);
  if (!Number.isFinite(ms)) return false;
  return Date.now() - ms < windowMs;
}

export function deriveBackfillUxPhase(
  state: StravaIngestStateForBackfill | null,
  syncedActivityCount: number
): StravaBackfillUxPhase {
  if (isRecent(state?.last_rate_limit_at ?? null, RATE_LIMIT_RECENCY_MS)) {
    return "rate_limited";
  }
  if (
    state?.last_error?.trim() &&
    isRecent(state.updated_at, ERROR_BLOCK_RECENCY_MS) &&
    !isRecent(state.last_rate_limit_at ?? null, RATE_LIMIT_RECENCY_MS)
  ) {
    return "needs_attention";
  }

  if (state?.backfill_exhausted) {
    const batches = state.backfill_batches_completed ?? 0;
    if (syncedActivityCount === 0 && batches > 0) return "no_matches";
    return "complete";
  }

  if ((state?.backfill_batches_completed ?? 0) > 0) return "partial";

  return "ready";
}
