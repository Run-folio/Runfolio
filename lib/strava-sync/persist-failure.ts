/**
 * Serializable Strava sync persist diagnostics (safe to return from server actions to the client).
 * Not marked server-only — UI can import this type.
 */

export const STRAVA_SYNC_PERSIST_FAILURE_CAP = 32;

export type StravaPersistFailureKind =
  | "abort_no_auth_session"
  | "abort_jwt_user_mismatch"
  | "select_existing_failed"
  | "update_failed"
  | "update_zero_rows"
  | "insert_after_update_zero_failed"
  | "insert_after_update_zero_empty"
  | "insert_failed"
  | "insert_zero_rows";

export type StravaPersistOperation =
  | "batch_abort"
  | "select"
  | "update"
  | "insert"
  | "insert_fallback";

/** One failed write (or batch-level abort). */
export type StravaPersistFailure = {
  kind: StravaPersistFailureKind;
  operation: StravaPersistOperation;
  strava_activity_id: string | null;
  param_user_id: string | null;
  jwt_user_id: string | null;
  existing_row_id: string | null;
  fallback_insert_attempted: boolean;
  /** PostgREST / Postgres error code when present (e.g. PGRST301, 23505). */
  postgres_code: string | null;
  message: string;
  details: string | null;
  hint: string | null;
  /** Batch abort only — how many activities would have been written. */
  affected_count?: number;
  /** Short snapshot for support (not full row). */
  payload_summary?: {
    start_date?: string;
    distance_m?: number | null;
    sport_type?: string | null;
    activity_type?: string | null;
  };
};

export type PgErrorFields = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export function normalizePgDetails(details: unknown): string | null {
  if (details == null) return null;
  if (typeof details === "string") return details;
  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
}

export function pgErrorFromSupabase(e: PgErrorFields | null | undefined): {
  postgres_code: string | null;
  message: string;
  details: string | null;
  hint: string | null;
} {
  if (!e) {
    return { postgres_code: null, message: "(no error object)", details: null, hint: null };
  }
  return {
    postgres_code: e.code ?? null,
    message: e.message ?? "(empty message)",
    details: normalizePgDetails(e.details),
    hint: e.hint ?? null
  };
}
