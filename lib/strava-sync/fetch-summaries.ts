import { fetchStravaAthleteActivities, type StravaSummaryActivityJson } from "@/lib/strava-api";

export const PER_PAGE = 50;

/** Incremental “new since last sync” — keep small for rate limits. */
export const INCREMENTAL_MAX_PAGES = 4;

/** One backfill user action — bounded batch toward older history (pages within a date window). */
export const BACKFILL_DEFAULT_MAX_PAGES = 20;

/**
 * Each sequential batch requests Strava `after = before_cursor - chunk` so we scan a finite time depth per action,
 * then paginate up to {@link BACKFILL_DEFAULT_MAX_PAGES} pages inside that window (instead of 3 shallow pages across all time).
 */
export const BACKFILL_DATE_CHUNK_SEC = 90 * 24 * 3600;

/** Human-readable chunk size for UX copy (≈ {@link BACKFILL_DATE_CHUNK_SEC}). */
export const BACKFILL_DATE_CHUNK_DAYS = Math.round(BACKFILL_DATE_CHUNK_SEC / 86400);

/** Hard cap on list requests per user action (rate-limit safety). */
export const BACKFILL_MAX_PAGES_CAP = 25;

/**
 * First-ever backfill run uses a single list page so we minimize Strava calls before the first successful persist.
 * After that, walk up to {@link BACKFILL_DEFAULT_MAX_PAGES} pages per batch.
 */
export const BACKFILL_FIRST_BATCH_MAX_PAGES = 1;

/**
 * Minimum seconds between **starts** of the first-ever backfill batch (no cursor, zero batches).
 * Server-enforced; protects Strava quota from rapid re-clicks after 429.
 */
export const STRAVA_FIRST_BACKFILL_COOLDOWN_SEC = 60;

export function backfillMaxPagesForRun(state: {
  backfill_before_epoch: number | null;
  backfill_batches_completed: number;
} | null): number {
  const batches = state?.backfill_batches_completed ?? 0;
  const before = state?.backfill_before_epoch;
  if (before == null && batches === 0) return BACKFILL_FIRST_BATCH_MAX_PAGES;
  return Math.min(BACKFILL_DEFAULT_MAX_PAGES, BACKFILL_MAX_PAGES_CAP);
}

/** Lower bound (inclusive) for Strava `after=` when continuing backfill with a date chunk below `beforeEpoch`. */
export function backfillAfterEpochForChunk(beforeEpoch: number, chunkSec = BACKFILL_DATE_CHUNK_SEC): number | undefined {
  if (!Number.isFinite(beforeEpoch) || beforeEpoch <= 1) return undefined;
  const floored = Math.floor(beforeEpoch);
  if (floored <= chunkSec + 1) return undefined;
  return Math.max(1, floored - chunkSec);
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
  opts: { beforeEpoch?: number | null; afterEpoch?: number | null; maxPages: number }
): Promise<StravaSummaryActivityJson[]> {
  const maxPages = Math.min(Math.max(opts.maxPages, 1), BACKFILL_MAX_PAGES_CAP);
  const before = opts.beforeEpoch != null && opts.beforeEpoch > 0 ? Math.floor(opts.beforeEpoch) : undefined;
  const after =
    opts.afterEpoch != null && opts.afterEpoch > 0 ? Math.floor(opts.afterEpoch) : undefined;
  const all: StravaSummaryActivityJson[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const batch = await fetchStravaAthleteActivities(accessToken, {
      page,
      perPage: PER_PAGE,
      ...(before != null ? { before } : {}),
      ...(after != null ? { after } : {})
    });
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < PER_PAGE) break;
  }
  return all;
}
