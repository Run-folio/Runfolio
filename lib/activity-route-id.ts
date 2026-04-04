import { parseStravaActivityId } from "@/lib/strava-api";

export type ActivityPageId = { kind: "strava"; id: string } | { kind: "file_import"; id: string };

/** Stable synthetic id prefix for file imports (content-addressed). */
export const FILE_ACTIVITY_ID_PREFIX = "file_";

/**
 * Activity portfolio URL param: numeric Strava id, Strava URL, or `file_<sha256hex>` import key.
 */
export function fileActivityIdFromHash(hex64: string): string {
  return `${FILE_ACTIVITY_ID_PREFIX}${hex64.toLowerCase()}`;
}

export function parseActivityPageId(raw: string): ActivityPageId | null {
  const t = raw.trim();
  const strava = parseStravaActivityId(t);
  if (strava) return { kind: "strava", id: strava };
  const lower = t.toLowerCase();
  if (lower.startsWith(FILE_ACTIVITY_ID_PREFIX) && /^file_[a-f0-9]{64}$/.test(lower)) {
    return { kind: "file_import", id: lower };
  }
  return null;
}
