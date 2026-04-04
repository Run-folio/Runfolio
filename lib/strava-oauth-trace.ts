import { runfolioLog } from "@/lib/runfolio-log";

/** Stable scope for grep-friendly OAuth diagnostics (no secrets / tokens). */
export const STRAVA_OAUTH_TRACE_SCOPE = "strava.oauth.trace";

export type StravaOauthTraceMeta = Record<string, string | number | boolean | null | undefined>;

/** Step-by-step trace: safe for production (never pass tokens or client_secret). */
export function stravaOauthTrace(step: string, meta?: StravaOauthTraceMeta) {
  runfolioLog.info(STRAVA_OAUTH_TRACE_SCOPE, step, meta);
}
