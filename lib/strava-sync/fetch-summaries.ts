import { fetchStravaAthleteActivities, type StravaSummaryActivityJson } from "@/lib/strava-api";

const PER_PAGE = 50;

/** Incremental “new since last sync” — keep small for rate limits. */
export const INCREMENTAL_MAX_PAGES = 4;

/** One backfill user action — bounded batch toward older history. */
export const BACKFILL_DEFAULT_MAX_PAGES = 3;

/** Overlap window (seconds) so boundary activities aren’t missed on incremental. */
const AFTER_OVERLAP_SEC = 7200;

/**
 * Epoch for Strava `after=` from DB’s newest activity (incremental bootstrap / legacy users).
 */
export function syncAfterEpochFromLatestStart(isoLatest: string | null): number | undefined {
  if (!isoLatest?.trim()) return undefined;
  const ms = Date.parse(isoLatest);
  if (!Number.isFinite(ms)) return undefined;
  return Math.floor(ms / 1000) - AFTER_OVERLAP_SEC;
}

/**
 * Activities **newer** than `afterEpoch` (new PRs, post-last-sync runs). No `before`.
 */
export async function fetchStravaIncrementalSummaries(
  accessToken: string,
  afterEpoch: number
): Promise<StravaSummaryActivityJson[]> {
  const all: StravaSummaryActivityJson[] = [];
  for (let page = 1; page <= INCREMENTAL_MAX_PAGES; page++) {
    const batch = await fetchStravaAthleteActivities(accessToken, {
      page,
      perPage: PER_PAGE,
      after: afterEpoch
    });
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < PER_PAGE) break;
  }
  return all;
}

/**
 * Bounded **historical** batch: walk backward using Strava `before` when continuing,
 * or newest pages when `beforeEpoch` is null (first backfill batch).
 */
export async function fetchStravaBackfillBatch(
  accessToken: string,
  opts: { beforeEpoch?: number | null; maxPages: number }
): Promise<StravaSummaryActivityJson[]> {
  const maxPages = Math.min(Math.max(opts.maxPages, 1), 12);
  const before = opts.beforeEpoch != null && opts.beforeEpoch > 0 ? opts.beforeEpoch : undefined;
  const all: StravaSummaryActivityJson[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const batch = await fetchStravaAthleteActivities(accessToken, {
      page,
      perPage: PER_PAGE,
      ...(before != null ? { before } : {})
    });
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < PER_PAGE) break;
  }
  return all;
}
