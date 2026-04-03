import {
  BACKFILL_FIRST_BATCH_MAX_PAGES,
  backfillMaxPagesForRun,
  INCREMENTAL_MAX_PAGES,
  PER_PAGE,
  syncAfterEpochFromLatestStart
} from "@/lib/strava-sync/fetch-summaries";
import { filterSummariesForPersist } from "@/lib/strava-sync/import-scope";
import {
  getIngestState,
  getStravaIngestStateTableStatus,
  maxStartEpochFromSummaries,
  minStartEpochFromSummaries,
  recordIngestError,
  recordRateLimitHint,
  touchIncrementalSyncOnly,
  upsertIngestStateBackfill,
  upsertIngestStateIncremental
} from "@/lib/strava-sync/ingest-state";
import {
  getLatestSyncedStartDateIso,
  upsertStravaSummariesForUser,
  type SyncSummary
} from "@/lib/strava-sync/repository";
import { getValidStravaAccessToken } from "@/lib/strava-access-server";
import { createClient } from "@/lib/supabase/server";
import { refreshStravaAccessToken } from "@/lib/strava-oauth";
import { persistStravaTokensToCookies } from "@/lib/strava-cookies";
import { getStravaClientCredentials } from "@/lib/strava-env";
import { getStravaTokensFromCookies } from "@/lib/strava-cookies";
import {
  tryFetchStravaAthleteActivitiesPage,
  type StravaAthleteActivitiesPageResult,
  type StravaSummaryActivityJson
} from "@/lib/strava-api";
import { runfolioLog } from "@/lib/runfolio-log";

const AFTER_OVERLAP_SEC = 7200;

const inflightBackfillByUser = new Map<string, Promise<BackfillSyncResult>>();
const inflightIncrementalByUser = new Map<string, Promise<IncrementalSyncResult>>();

function rateLimitHintDetail(retryAfterSec: number | null): string {
  if (retryAfterSec != null && retryAfterSec > 0) {
    const mins = Math.max(1, Math.ceil(retryAfterSec / 60));
    return `Strava rate limit (Retry-After ~${mins} min).`;
  }
  return "Strava rate limit — try again shortly.";
}

export function formatStravaRateLimitUserMessage(
  retryAfterSec: number | null,
  savedSoFar: number
): string {
  const when =
    retryAfterSec != null && retryAfterSec > 0
      ? ` Strava asked to wait about ${Math.max(1, Math.ceil(retryAfterSec / 60))} minutes.`
      : "";
  if (savedSoFar <= 0) {
    return `Imported 0 activities before Strava paused this sync.${when}`;
  }
  return `Imported ${savedSoFar} activit${savedSoFar === 1 ? "y" : "ies"}. Strava paused further requests for now.${when}`;
}

async function fetchAthleteActivitiesPageWithRefresh(
  accessToken: string,
  listOpts: { page: number; perPage: number; after?: number; before?: number }
): Promise<StravaAthleteActivitiesPageResult> {
  let r = await tryFetchStravaAthleteActivitiesPage(accessToken, listOpts);
  if (!r.ok && r.kind === "unauthorized") {
    const cred = getStravaClientCredentials();
    const jar = await getStravaTokensFromCookies();
    const refresh = jar.refreshToken ?? process.env.STRAVA_REFRESH_TOKEN?.trim();
    if (cred && refresh) {
      try {
        const t = await refreshStravaAccessToken(refresh, cred.clientId, cred.clientSecret);
        await persistStravaTokensToCookies(t);
        r = await tryFetchStravaAthleteActivitiesPage(t.access_token, listOpts);
      } catch (e2) {
        runfolioLog.warn("strava.sync", "refresh failed", {
          detail: e2 instanceof Error ? e2.message : "unknown"
        });
        return {
          ok: false,
          status: 401,
          kind: "unauthorized",
          message: "Strava session expired — reconnect.",
          retryAfterSec: null
        };
      }
    }
  }
  return r;
}

export type IncrementalSyncResult =
  | (SyncSummary & {
      ok: true;
      mode: "incremental";
      requestsMade: number;
      stoppedForRateLimit: boolean;
      retryAfterSec: number | null;
      rateLimitUserMessage?: string;
    })
  | {
      ok: false;
      error: string;
      needBackfill?: boolean;
      requestsMade?: number;
      retryAfterSec?: number | null;
    };

/**
 * Incremental only — Strava activities **after** stored high-water (or newest synced row for legacy users).
 * Empty sync table: user must run {@link backfillStravaHistoryForUserId} first.
 */
export async function syncStravaActivitiesForUserId(userId: string): Promise<IncrementalSyncResult> {
  const existing = inflightIncrementalByUser.get(userId);
  if (existing) return existing;
  const p = runIncrementalSync(userId).finally(() => {
    if (inflightIncrementalByUser.get(userId) === p) inflightIncrementalByUser.delete(userId);
  });
  inflightIncrementalByUser.set(userId, p);
  return p;
}

async function runIncrementalSync(userId: string): Promise<IncrementalSyncResult> {
  const supabase = await createClient();
  const ingestTable = await getStravaIngestStateTableStatus(supabase);
  if (!ingestTable.ok) {
    return { ok: false, error: ingestTable.message };
  }
  const state = await getIngestState(supabase, userId);
  const latestIso = await getLatestSyncedStartDateIso(supabase, userId);

  let afterEpoch: number | undefined;
  if (state?.incremental_high_water_epoch != null && state.incremental_high_water_epoch > 0) {
    afterEpoch = Math.max(0, state.incremental_high_water_epoch - AFTER_OVERLAP_SEC);
  } else if (latestIso) {
    afterEpoch = syncAfterEpochFromLatestStart(latestIso);
  } else {
    return {
      ok: false,
      error:
        "Import past race efforts first (Past races in the nav), then sync only picks up new activities.",
      needBackfill: true
    };
  }

  if (afterEpoch == null || afterEpoch <= 0) {
    return { ok: false, error: "Could not compute incremental Strava cursor — run a historical import batch." };
  }

  let totalUpserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let requestsMade = 0;
  let stoppedForRateLimit = false;
  let retryAfterSec: number | null = null;
  let totalRaw = 0;
  let totalEligible = 0;

  for (let page = 1; page <= INCREMENTAL_MAX_PAGES; page++) {
    const token = await getValidStravaAccessToken();
    if (!token) {
      await recordIngestError(supabase, userId, "Connect Strava first.");
      return { ok: false, error: "Connect Strava first." };
    }

    const r = await fetchAthleteActivitiesPageWithRefresh(token, {
      page,
      perPage: PER_PAGE,
      after: afterEpoch
    });
    requestsMade++;

    if (!r.ok && r.kind === "rate_limit") {
      stoppedForRateLimit = true;
      retryAfterSec = r.retryAfterSec;
      await recordRateLimitHint(supabase, userId, rateLimitHintDetail(r.retryAfterSec));
      runfolioLog.warn("strava.sync.incremental", "rate_limit", {
        userId,
        page,
        requestsMade,
        hadPersistBeforeRateLimit: totalRaw > 0,
        retryAfterSec
      });
      break;
    }

    if (!r.ok) {
      const msg = r.message || `Strava list error ${r.status}`;
      await recordIngestError(supabase, userId, msg);
      return { ok: false, error: msg, requestsMade };
    }

    const batch = r.data;
    if (batch.length === 0) break;

    totalRaw += batch.length;
    const items = filterSummariesForPersist(batch, "incremental");
    totalEligible += items.length;
    const result = await upsertStravaSummariesForUser(supabase, userId, items);
    totalUpserted += result.upserted;
    totalSkipped += result.skippedUnchanged;
    totalErrors += result.errors;

    const pageMax = maxStartEpochFromSummaries(batch);
    if (pageMax != null) {
      await upsertIngestStateIncremental(supabase, userId, pageMax);
    }

    runfolioLog.info("strava.sync.incremental", "page_persisted", {
      userId,
      page,
      requestsMade,
      batchLen: batch.length,
      eligible: items.length,
      upserted: result.upserted,
      rateLimitedAfter: false
    });

    if (batch.length < PER_PAGE) break;
  }

  if (totalRaw === 0 && !stoppedForRateLimit) {
    await touchIncrementalSyncOnly(supabase, userId);
  }

  if (stoppedForRateLimit && totalRaw === 0) {
    return {
      ok: false,
      error: formatStravaRateLimitUserMessage(retryAfterSec, 0),
      requestsMade,
      retryAfterSec
    };
  }

  const rateLimitUserMessage = stoppedForRateLimit
    ? formatStravaRateLimitUserMessage(retryAfterSec, totalUpserted)
    : undefined;

  return {
    ok: true,
    mode: "incremental",
    upserted: totalUpserted,
    skippedUnchanged: totalSkipped,
    errors: totalErrors,
    requestsMade,
    stoppedForRateLimit,
    retryAfterSec,
    rateLimitUserMessage
  };
}

export type BackfillSyncResult =
  | (SyncSummary & {
      ok: true;
      mode: "backfill";
      backfillExhausted: boolean;
      rawFetched: number;
      eligibleInBatch: number;
      requestsMade: number;
      stoppedForRateLimit: boolean;
      retryAfterSec: number | null;
      hadPersistBeforeRateLimit: boolean;
      /** Shown after a batch that hit rate limits (especially mid-batch). */
      rateLimitUserMessage?: string;
    })
  | {
      ok: false;
      error: string;
      requestsMade?: number;
      retryAfterSec?: number | null;
      hadPersistBeforeRateLimit?: boolean;
    };

/**
 * Bounded historical backfill (resumable). Each call fetches at most `maxPages` list pages,
 * then advances `backfill_before_epoch` toward older activities.
 */
export async function backfillStravaHistoryForUserId(
  userId: string,
  opts?: { maxPages?: number }
): Promise<BackfillSyncResult> {
  const existing = inflightBackfillByUser.get(userId);
  if (existing) return existing;
  const p = runBackfillStravaHistory(userId, opts).finally(() => {
    if (inflightBackfillByUser.get(userId) === p) inflightBackfillByUser.delete(userId);
  });
  inflightBackfillByUser.set(userId, p);
  return p;
}

async function runBackfillStravaHistory(
  userId: string,
  opts?: { maxPages?: number }
): Promise<BackfillSyncResult> {
  const supabase = await createClient();
  const ingestTable = await getStravaIngestStateTableStatus(supabase);
  if (!ingestTable.ok) {
    return { ok: false, error: ingestTable.message };
  }
  const state = await getIngestState(supabase, userId);
  if (state?.backfill_exhausted) {
    return {
      ok: false,
      error:
        "Historical import finished — Strava returned no more older activities. Your synced history is complete."
    };
  }

  const defaultMax = backfillMaxPagesForRun(state);
  /** First-ever backfill: always one list request before ingest cursor advances — ignore higher `opts.maxPages`. */
  const maxPages =
    defaultMax === BACKFILL_FIRST_BATCH_MAX_PAGES
      ? BACKFILL_FIRST_BATCH_MAX_PAGES
      : Math.min(Math.max(opts?.maxPages ?? defaultMax, 1), 12);
  const beforeEpoch = state?.backfill_before_epoch ?? undefined;
  const before = beforeEpoch != null && beforeEpoch > 0 ? beforeEpoch : undefined;

  let totalUpserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let totalRaw = 0;
  let totalEligible = 0;
  const allSummaries: StravaSummaryActivityJson[] = [];
  let requestsMade = 0;
  let stoppedForRateLimit = false;
  let retryAfterSec: number | null = null;

  for (let page = 1; page <= maxPages; page++) {
    const token = await getValidStravaAccessToken();
    if (!token) {
      await recordIngestError(supabase, userId, "Connect Strava first.");
      return { ok: false, error: "Connect Strava first." };
    }

    const r = await fetchAthleteActivitiesPageWithRefresh(token, {
      page,
      perPage: PER_PAGE,
      ...(before != null ? { before } : {})
    });
    requestsMade++;

    if (!r.ok && r.kind === "rate_limit") {
      stoppedForRateLimit = true;
      retryAfterSec = r.retryAfterSec;
      await recordRateLimitHint(supabase, userId, rateLimitHintDetail(r.retryAfterSec));
      runfolioLog.warn("strava.backfill", "rate_limit", {
        userId,
        page,
        requestsMade,
        hadPersistBeforeRateLimit: allSummaries.length > 0,
        retryAfterSec
      });
      break;
    }

    if (!r.ok) {
      const msg = r.message || `Strava list error ${r.status}`;
      await recordIngestError(supabase, userId, msg);
      return { ok: false, error: msg, requestsMade };
    }

    const batch = r.data;
    if (batch.length === 0) break;

    allSummaries.push(...batch);
    totalRaw += batch.length;
    const items = filterSummariesForPersist(batch, "historical_backfill");
    totalEligible += items.length;
    const result = await upsertStravaSummariesForUser(supabase, userId, items);
    totalUpserted += result.upserted;
    totalSkipped += result.skippedUnchanged;
    totalErrors += result.errors;

    runfolioLog.info("strava.backfill", "page_persisted", {
      userId,
      page,
      requestsMade,
      batchLen: batch.length,
      eligible: items.length,
      upserted: result.upserted
    });

    if (batch.length < PER_PAGE) break;
  }

  const hadPersistBeforeRateLimit = allSummaries.length > 0;

  if (stoppedForRateLimit && !hadPersistBeforeRateLimit) {
    return {
      ok: false,
      error: formatStravaRateLimitUserMessage(retryAfterSec, 0),
      requestsMade,
      retryAfterSec,
      hadPersistBeforeRateLimit: false
    };
  }

  if (allSummaries.length === 0 && !stoppedForRateLimit) {
    await upsertIngestStateBackfill(supabase, userId, {
      nextBeforeEpoch: beforeEpoch ?? null,
      exhausted: true,
      alsoBumpIncrementalEpoch: null
    });
    return {
      ok: true,
      mode: "backfill",
      upserted: 0,
      skippedUnchanged: 0,
      errors: 0,
      backfillExhausted: true,
      rawFetched: 0,
      eligibleInBatch: 0,
      requestsMade,
      stoppedForRateLimit: false,
      retryAfterSec: null,
      hadPersistBeforeRateLimit: false
    };
  }

  const minEp = minStartEpochFromSummaries(allSummaries);
  const maxEp = maxStartEpochFromSummaries(allSummaries);
  const nextBefore = minEp != null ? minEp - 1 : null;

  await upsertIngestStateBackfill(supabase, userId, {
    nextBeforeEpoch: nextBefore,
    exhausted: false,
    alsoBumpIncrementalEpoch: maxEp
  });

  const rateLimitUserMessage = stoppedForRateLimit
    ? formatStravaRateLimitUserMessage(retryAfterSec, totalUpserted)
    : undefined;

  if (stoppedForRateLimit) {
    runfolioLog.warn("strava.backfill", "batch_done_rate_limited_after_persist", {
      userId,
      requestsMade,
      rawFetched: totalRaw,
      upserted: totalUpserted
    });
  }

  return {
    ok: true,
    mode: "backfill",
    backfillExhausted: false,
    rawFetched: totalRaw,
    eligibleInBatch: totalEligible,
    upserted: totalUpserted,
    skippedUnchanged: totalSkipped,
    errors: totalErrors,
    requestsMade,
    stoppedForRateLimit,
    retryAfterSec,
    hadPersistBeforeRateLimit,
    rateLimitUserMessage
  };
}
