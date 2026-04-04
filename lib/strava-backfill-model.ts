const RATE_LIMIT_RECENCY_MS = 20 * 60 * 1000;
const ERROR_BLOCK_RECENCY_MS = 2 * 60 * 60 * 1000;

/** Mirrors `user_strava_ingest_state.strava_rate_limit_kind` after rate-limit meta migration. */
export type StravaRateLimitUxKind = "short_window" | "daily" | "unknown";

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
  /** Set after a batch finishes and the backfill cursor advances (or exhausted path completes). */
  last_backfill_at?: string | null;
  /** Non-null after at least one successful backfill batch moved the `before` cursor. */
  backfill_before_epoch?: number | null;
  last_rate_limit_at: string | null;
  last_error: string | null;
  strava_rate_limit_kind?: string | null;
  strava_rate_limit_until?: string | null;
  updated_at: string;
};

export type StravaBackfillProgress = {
  phase: StravaBackfillUxPhase;
  syncedActivityCount: number;
  backfillBatchesCompleted: number;
  /** Strava list cursor for older pages; non-null after a batch advanced history. */
  backfillBeforeEpoch: number | null;
  backfillExhausted: boolean;
  moreHistoryAvailable: boolean;
  lastBackfillAt: string | null;
  lastRateLimitAt: string | null;
  lastError: string | null;
  /** Parsed from ingest state when migration `migration_strava_rate_limit_meta.sql` is applied. */
  stravaRateLimitKind: StravaRateLimitUxKind | null;
  stravaRateLimitUntil: string | null;
  updatedAt: string | null;
  /**
   * False when `user_strava_ingest_state` is missing or unreadable (migration not applied or RLS).
   * Progress counts remain from `strava_synced_activities`; phases fall back to needs_attention with `lastError`.
   */
  ingestStateTableAvailable: boolean;
};

/** True when ingest state shows any completed backfill batch (independent of rows saved). */
export function hasServerRecordedStravaBackfillBatch(progress: StravaBackfillProgress): boolean {
  if (!progress.ingestStateTableAvailable) return false;
  return (
    progress.backfillBatchesCompleted > 0 ||
    Boolean(progress.lastBackfillAt?.trim()) ||
    progress.backfillBeforeEpoch != null
  );
}

function isRecent(ts: string | null, windowMs: number): boolean {
  if (!ts?.trim()) return false;
  const ms = Date.parse(ts);
  if (!Number.isFinite(ms)) return false;
  return Date.now() - ms < windowMs;
}

export function coerceStravaRateLimitUxKind(raw: string | null | undefined): StravaRateLimitUxKind | null {
  if (raw === "short_window" || raw === "daily" || raw === "unknown") return raw;
  return null;
}

export function deriveBackfillUxPhase(
  state: StravaIngestStateForBackfill | null,
  syncedActivityCount: number
): StravaBackfillUxPhase {
  const untilRaw = state?.strava_rate_limit_until ?? null;
  const untilMs = untilRaw ? Date.parse(untilRaw) : NaN;
  if (Number.isFinite(untilMs) && Date.now() < untilMs) {
    return "rate_limited";
  }
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

  const batches = state?.backfill_batches_completed ?? 0;
  const lastBackfill = Boolean(state?.last_backfill_at?.trim());
  const cursorSet = state?.backfill_before_epoch != null;
  if (batches > 0 || lastBackfill || cursorSet) return "partial";

  return "ready";
}
