import { fetchStravaAthleteActivities, type StravaSummaryActivityJson } from "@/lib/strava-api";

export const PER_PAGE = 50;

/** Incremental “new since last sync” — keep small for rate limits. */
export const INCREMENTAL_MAX_PAGES = 4;

/** One backfill user action — bounded batch toward older history. */
export const BACKFILL_DEFAULT_MAX_PAGES = 3;

/**
 * First-ever backfill run uses a single list page so we minimize Strava calls before the first successful persist.
 * After that, walk up to {@link BACKFILL_DEFAULT_MAX_PAGES} pages per batch.
 */
export const BACKFILL_FIRST_BATCH_MAX_PAGES = 1;

export function backfillMaxPagesForRun(state: {
  backfill_before_epoch: number | null;
  backfill_batches_completed: number;
} | null): number {
  const batches = state?.backfill_batches_completed ?? 0;
  const before = state?.backfill_before_epoch;
  if (before == null && batches === 0) return BACKFILL_FIRST_BATCH_MAX_PAGES;
  return BACKFILL_DEFAULT_MAX_PAGES;
}

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
