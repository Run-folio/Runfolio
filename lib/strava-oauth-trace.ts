import { runfolioLog } from "@/lib/runfolio-log";

/** Stable scope for grep-friendly OAuth diagnostics (no secrets / tokens). */
export const STRAVA_OAUTH_TRACE_SCOPE = "strava.oauth.trace";

export type StravaOauthTraceMeta = Record<string, string | number | boolean | null | undefined>;

/**
 * OAuth checkpoint logs — grep `[strava.oauth.trace] oauth_authorize_url_built` etc.
 * Never pass tokens, codes, or client_secret.
 */
export type StravaOauthCheckpoint =
  | "oauth_authorize_url_built"
  | "oauth_callback_received"
  | "oauth_state_ok"
  | "oauth_aborted"
  | "token_exchange_ok"
  | "token_exchange_failed"
  | "athlete_fetch_ok"
  | "athlete_fetch_failed"
  | "credentials_upsert_ok"
  | "credentials_upsert_failed"
  | "session_create_ok"
  | "session_create_failed"
  | "reconnect_ok"
  | "reconnect_failed"
  | string;

/** Safe for production (never pass tokens or client_secret). */
export function stravaOauthTrace(checkpoint: StravaOauthCheckpoint, meta?: StravaOauthTraceMeta) {
  runfolioLog.info(STRAVA_OAUTH_TRACE_SCOPE, checkpoint, meta);
}
