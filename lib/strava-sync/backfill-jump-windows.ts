/** Rolling windows for one-shot “jump” scans (do not move the sequential backfill cursor). */

const SEC_PER_DAY = 86400;
const DAYS_PER_YEAR = 365;

export type StravaBackfillJumpPreset =
  | "last_12m"
  | "months_12_24"
  | "months_24_36"
  | "months_36_60"
  | "months_60_plus";

/** ~N months ≈ N/12 × 365d — matches existing presets; labels use months for readability. */
export const STRAVA_BACKFILL_JUMP_OPTIONS: { value: StravaBackfillJumpPreset; label: string; hint: string }[] = [
  {
    value: "last_12m",
    label: "Last ~12 months",
    hint: "From today back one year — good for last season’s marathon."
  },
  {
    value: "months_12_24",
    label: "~12–24 months ago",
    hint: "The year before last — e.g. Chicago last year if you’re already current this year."
  },
  {
    value: "months_24_36",
    label: "~24–36 months ago",
    hint: "Third year back — without walking every page from today."
  },
  {
    value: "months_36_60",
    label: "~36–60 months ago",
    hint: "Roughly three to five years ago — ultras and older marathons in one bounded batch."
  },
  {
    value: "months_60_plus",
    label: "~60+ months ago",
    hint: "Older than ~5 years — deep archive in one rate-limited batch (same cap as other jumps). Main “Continue backfill” still walks ordered history from today."
  }
];

/** Strava `after` / `before` are epoch seconds; activities strictly between these bounds (per Strava list API). */
export function epochWindowForJumpPreset(preset: StravaBackfillJumpPreset): { after: number; before: number } {
  const now = Math.floor(Date.now() / 1000);
  const y = DAYS_PER_YEAR * SEC_PER_DAY;
  switch (preset) {
    case "last_12m":
      return { after: Math.max(1, now - y), before: now };
    case "months_12_24":
      return { after: Math.max(1, now - 2 * y), before: now - y };
    case "months_24_36":
      return { after: Math.max(1, now - 3 * y), before: now - 2 * y };
    case "months_36_60":
      return { after: Math.max(1, now - 5 * y), before: now - 3 * y };
    case "months_60_plus": {
      const before = now - 5 * y;
      return { after: 1, before: Math.max(2, before) };
    }
  }
}

export function parseStravaBackfillJumpPreset(raw: string | null | undefined): StravaBackfillJumpPreset | null {
  if (
    raw === "last_12m" ||
    raw === "months_12_24" ||
    raw === "months_24_36" ||
    raw === "months_36_60" ||
    raw === "months_60_plus"
  ) {
    return raw;
  }
  return null;
}
