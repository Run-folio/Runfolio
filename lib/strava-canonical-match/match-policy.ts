/**
 * Canonical Strava ↔ catalog confidence bands (client-safe).
 * Keep this file free of server-only imports so dashboard UI can share thresholds with the Match hub.
 */
export const CANONICAL_MATCH_MIN_SCORE = 60;
export const CANONICAL_SUGGESTED_HIGH_MIN_SCORE = 80;

/** Max teaser cards on Overview / dashboard (full Match & Import hub lists every ≥80% row). */
export const CANONICAL_SUGGESTED_UI_MAX_COUNT = 3;

/**
 * Manual linking hints only: show likely races below the auto-suggest bar (52–79%).
 * Never auto-select; user must confirm.
 */
export const CANONICAL_MANUAL_HINT_MIN_SCORE = 52;
export const CANONICAL_MANUAL_HINT_MAX = 4;
