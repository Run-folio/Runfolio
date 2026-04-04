import type { StravaBackfillJumpPreset } from "@/lib/strava-sync/backfill-jump-windows";
import { epochWindowForJumpPreset } from "@/lib/strava-sync/backfill-jump-windows";
import {
  BACKFILL_FIRST_BATCH_MAX_PAGES,
  BACKFILL_MAX_PAGES_CAP,
  backfillAfterEpochForChunk,
  backfillMaxPagesForRun,
  INCREMENTAL_MAX_PAGES,
  PER_PAGE,
  STRAVA_FIRST_BACKFILL_COOLDOWN_SEC,
  syncAfterEpochFromLatestStart
} from "@/lib/strava-sync/fetch-summaries";
import {
  filterSummariesForPersist,
  logHistoricalBackfillImportEvalIfEnabled,
  partitionSummariesForHistoricalBackfill
} from "@/lib/strava-sync/import-scope";
import {
  firstBackfillCooldownRemainingSec,
  getIngestState,
  getStravaIngestStateTableStatus,
  markFirstBackfillAttemptNow,
  maxStartEpochFromSummaries,
  minStartEpochFromSummaries,
  recordIngestError,
  recordRateLimitHint,
  touchIncrementalSyncOnly,
  upsertIngestStateBackfill,
  upsertIngestStateIncremental
} from "@/lib/strava-sync/ingest-state";
import {
  STRAVA_SYNC_PERSIST_FAILURE_CAP,
  type StravaPersistFailure
} from "@/lib/strava-sync/persist-failure";
import {
  getLatestSyncedStartDateIso,
  upsertStravaSummariesForUser,
  type SyncSummary
} from "@/lib/strava-sync/repository";
import { createClient } from "@/lib/supabase/server";
import {
  getStravaAccessTokenWithoutProactiveRefreshForUser,
  getValidStravaAccessTokenForUser,
  refreshStravaAccessTokenForUser
} from "@/lib/strava-credentials-db";
import {
  tryFetchStravaAthleteActivitiesPage,
  type StravaAthleteActivitiesPageResult,
  type StravaSummaryActivityJson
} from "@/lib/strava-api";
import { classifyStrava429FromHeaders, logStrava429Classification } from "@/lib/strava-rate-limit";
import { runfolioLog } from "@/lib/runfolio-log";
import { ensureUserStravaProfileUrl } from "@/lib/strava-user-profile";
import type { SupabaseClient } from "@supabase/supabase-js";

const AFTER_OVERLAP_SEC = 7200;

function appendPersistFailures(bucket: StravaPersistFailure[], incoming: StravaPersistFailure[]): void {
  for (const f of incoming) {
    if (bucket.length >= STRAVA_SYNC_PERSIST_FAILURE_CAP) return;
    bucket.push(f);
  }
}

type StravaListOpKind = "backfill" | "incremental";

const inflightStravaListByUser = new Map<
  string,
  { kind: StravaListOpKind; promise: Promise<unknown> }
>();

/**
 * One in-flight Strava list operation per user: duplicate backfill dedupes; backfill vs incremental excludes.
 */
function enterStravaListOp<T>(userId: string, kind: StravaListOpKind, run: () => Promise<T>): Promise<T> {
  const cur = inflightStravaListByUser.get(userId);
  if (cur) {
    if (cur.kind === kind) {
      return cur.promise as Promise<T>;
    }
    runfolioLog.info("strava.sync", "blocked_concurrent_list_op", { userId, requested: kind, active: cur.kind });
    return Promise.reject(
      new Error("Another Strava import or sync is already running. Wait for it to finish before retrying.")
    ) as Promise<T>;
  }
  const promise = run().finally(() => {
    if (inflightStravaListByUser.get(userId)?.promise === promise) {
      inflightStravaListByUser.delete(userId);
    }
  });
  inflightStravaListByUser.set(userId, { kind, promise });
  return promise;
}

function stravaHeadersForLog(h: Record<string, string>): string {
  try {
    return JSON.stringify(h).slice(0, 450);
  } catch {
    return "";
  }
}

export function formatStravaRateLimitUserMessage(
  savedSoFar: number,
  headers: Record<string, string>,
  retryAfterSec: number | null
): string {
  const rl = classifyStrava429FromHeaders(headers, retryAfterSec);
  if (savedSoFar <= 0) return rl.userMessage;
  return `Imported ${savedSoFar} activit${savedSoFar === 1 ? "y" : "ies"}. ${rl.userMessage}`;
}

type StravaRateLimitPageResult = {
  ok: false;
  httpStatus: number;
  kind: "rate_limit";
  message: string;
  retryAfterSec: number | null;
  rateLimitHeaders: Record<string, string>;
};

async function recordClassifiedStrava429(
  supabase: SupabaseClient,
  userId: string,
  r: StravaRateLimitPageResult,
  log: { scope: string; firstEndpoint: string }
): Promise<{ headers: Record<string, string>; retryAfterSec: number | null }> {
  const rl = classifyStrava429FromHeaders(r.rateLimitHeaders, r.retryAfterSec);
  await recordRateLimitHint(supabase, userId, rl.userMessage, {
    kind: rl.kind,
    untilIso: rl.untilIso
  });
  logStrava429Classification(log.scope, {
    userId,
    firstEndpoint: log.firstEndpoint,
    httpStatus: r.httpStatus,
    classification: rl
  });
  return { headers: r.rateLimitHeaders, retryAfterSec: r.retryAfterSec };
}

type AthleteListFetchMetrics = {
  result: StravaAthleteActivitiesPageResult;
  /** Successful HTTP calls to `GET /athlete/activities` (includes 401 retry). */
  athleteActivitiesListHttpCalls: number;
  /** Calls to `POST /oauth/token` refresh from this helper. */
  oauthTokenRefreshCalls: number;
};

async function fetchAthleteActivitiesPageWithRefresh(
  accessToken: string,
  listOpts: { page: number; perPage: number; after?: number; before?: number },
  userId: string
): Promise<AthleteListFetchMetrics> {
  let athleteActivitiesListHttpCalls = 0;
  let oauthTokenRefreshCalls = 0;

  let r = await tryFetchStravaAthleteActivitiesPage(accessToken, listOpts);
  athleteActivitiesListHttpCalls++;

  if (!r.ok && r.kind === "unauthorized") {
    const refreshed = await refreshStravaAccessTokenForUser(userId);
    oauthTokenRefreshCalls++;
    if (refreshed) {
      r = await tryFetchStravaAthleteActivitiesPage(refreshed, listOpts);
      athleteActivitiesListHttpCalls++;
    } else {
      runfolioLog.warn("strava.sync", "refresh failed after 401", { userId });
      return {
        result: {
          ok: false,
          httpStatus: 401,
          kind: "unauthorized",
          message: "Strava session expired — reconnect Strava from My Races or Overview.",
          retryAfterSec: null,
          rateLimitHeaders: {}
        },
        athleteActivitiesListHttpCalls,
        oauthTokenRefreshCalls
      };
    }
  }

  return { result: r, athleteActivitiesListHttpCalls, oauthTokenRefreshCalls };
}

export type IncrementalSyncResult =
  | (SyncSummary & {
      ok: true;
      mode: "incremental";
      /** Total `GET /athlete/activities` HTTP calls for this action. */
      requestsMade: number;
      stravaOauthRefreshCalls: number;
      stoppedForRateLimit: boolean;
      retryAfterSec: number | null;
      rateLimitUserMessage?: string;
    })
  | {
      ok: false;
      error: string;
      needBackfill?: boolean;
      needStravaReconnect?: boolean;
      requestsMade?: number;
      stravaOauthRefreshCalls?: number;
      retryAfterSec?: number | null;
    };

/**
 * Incremental only — Strava activities **after** stored high-water (or newest synced row for legacy users).
 * Empty sync table: user must run {@link backfillStravaHistoryForUserId} first.
 *
 * Pass `supabaseClient` from server actions (same session as `requireActionPersistence`) so RLS writes
 * are not accidentally run with an unauthenticated client from a nested `createClient()`.
 */
export async function syncStravaActivitiesForUserId(
  userId: string,
  supabaseClient?: SupabaseClient
): Promise<IncrementalSyncResult> {
  return enterStravaListOp(userId, "incremental", () => runIncrementalSync(userId, supabaseClient));
}

async function runIncrementalSync(userId: string, supabaseClient?: SupabaseClient): Promise<IncrementalSyncResult> {
  const supabase = supabaseClient ?? (await createClient());
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
        "Import past race efforts from My Races first, then sync only picks up new activities.",
      needBackfill: true
    };
  }

  if (afterEpoch == null || afterEpoch <= 0) {
    return { ok: false, error: "Could not compute incremental Strava cursor — run a historical import batch." };
  }

  let totalUpserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let totalSkippedInvalid = 0;
  let totalWriteAttempts = 0;
  const totalPersistFailures: StravaPersistFailure[] = [];
  let requestsMade = 0;
  let stoppedForRateLimit = false;
  let retryAfterSec: number | null = null;
  let totalRaw = 0;
  let totalEligible = 0;
  let stravaOauthRefreshCalls = 0;
  let rateLimitSnap: { headers: Record<string, string>; retryAfterSec: number | null } | null = null;

  for (let page = 1; page <= INCREMENTAL_MAX_PAGES; page++) {
    const token = await getValidStravaAccessTokenForUser(userId);
    if (!token) {
      await recordIngestError(supabase, userId, "Connect Strava first — use Continue with Strava to sign in.");
      return { ok: false, error: "Connect Strava first — use My Races or Overview to reconnect.", needStravaReconnect: true };
    }

    if (page === 1) {
      await ensureUserStravaProfileUrl(supabase, userId, token);
    }
    const { result: r, athleteActivitiesListHttpCalls, oauthTokenRefreshCalls } =
      await fetchAthleteActivitiesPageWithRefresh(
        token,
        {
          page,
          perPage: PER_PAGE,
          after: afterEpoch
        },
        userId
      );
    requestsMade += athleteActivitiesListHttpCalls;
    stravaOauthRefreshCalls += oauthTokenRefreshCalls;

    if (!r.ok && r.kind === "rate_limit") {
      stoppedForRateLimit = true;
      retryAfterSec = r.retryAfterSec;
      rateLimitSnap = await recordClassifiedStrava429(supabase, userId, r as unknown as StravaRateLimitPageResult, {
        scope: "strava.sync.incremental",
        firstEndpoint: "GET /api/v3/athlete/activities"
      });
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
      const msg = r.message || `Strava list error ${r.httpStatus}`;
      await recordIngestError(supabase, userId, msg);
      return { ok: false, error: msg, requestsMade, stravaOauthRefreshCalls };
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
    totalSkippedInvalid += result.skippedInvalid;
    totalWriteAttempts += result.writeAttempts;
    appendPersistFailures(totalPersistFailures, result.persistFailures);

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
      skippedUnchanged: result.skippedUnchanged,
      skippedInvalid: result.skippedInvalid,
      writeAttempts: result.writeAttempts,
      errors: result.errors,
      persistFailureKinds: result.persistFailures.map((f) => f.kind).join(","),
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
      error: formatStravaRateLimitUserMessage(
        0,
        rateLimitSnap?.headers ?? {},
        rateLimitSnap?.retryAfterSec ?? retryAfterSec
      ),
      requestsMade,
      stravaOauthRefreshCalls,
      retryAfterSec
    };
  }

  const rateLimitUserMessage = stoppedForRateLimit
    ? formatStravaRateLimitUserMessage(
        totalUpserted,
        rateLimitSnap?.headers ?? {},
        retryAfterSec
      )
    : undefined;

  return {
    ok: true,
    mode: "incremental",
    upserted: totalUpserted,
    skippedUnchanged: totalSkipped,
    errors: totalErrors,
    skippedInvalid: totalSkippedInvalid,
    writeAttempts: totalWriteAttempts,
    persistFailures: totalPersistFailures,
    requestsMade,
    stravaOauthRefreshCalls,
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
      /** Total `GET /athlete/activities` HTTP calls for this action. */
      requestsMade: number;
      stravaOauthRefreshCalls: number;
      stoppedForRateLimit: boolean;
      retryAfterSec: number | null;
      hadPersistBeforeRateLimit: boolean;
      /** Shown after a batch that hit rate limits (especially mid-batch). */
      rateLimitUserMessage?: string;
      /** One-shot date-window scan — did not move `backfill_before_epoch`. */
      jumpScan?: boolean;
    })
  | {
      ok: false;
      error: string;
      needStravaReconnect?: boolean;
      requestsMade?: number;
      stravaOauthRefreshCalls?: number;
      retryAfterSec?: number | null;
      hadPersistBeforeRateLimit?: boolean;
    };

/**
 * Bounded historical backfill (resumable). Each call fetches at most `maxPages` list pages,
 * then advances `backfill_before_epoch` toward older activities.
 */
export async function backfillStravaHistoryForUserId(
  userId: string,
  opts?: { maxPages?: number; jumpPreset?: StravaBackfillJumpPreset; supabase?: SupabaseClient }
): Promise<BackfillSyncResult> {
  return enterStravaListOp(userId, "backfill", () => runBackfillStravaHistory(userId, opts));
}

/**
 * Paginate Strava inside a fixed [after, before] window, upsert matches, **without** advancing ingest cursors.
 */
async function runBackfillJumpScan(
  userId: string,
  window: { after: number; before: number },
  supabase: SupabaseClient
): Promise<BackfillSyncResult> {
  const ingestTable = await getStravaIngestStateTableStatus(supabase);
  if (!ingestTable.ok) {
    return { ok: false, error: ingestTable.message };
  }

  let totalUpserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let totalSkippedInvalid = 0;
  let totalWriteAttempts = 0;
  const totalPersistFailures: StravaPersistFailure[] = [];
  let totalRaw = 0;
  let totalEligible = 0;
  const allSummaries: StravaSummaryActivityJson[] = [];
  let requestsMade = 0;
  let stravaOauthRefreshCalls = 0;
  let stoppedForRateLimit = false;
  let retryAfterSec: number | null = null;
  let rateLimitSnap: { headers: Record<string, string>; retryAfterSec: number | null } | null = null;
  const maxPages = BACKFILL_MAX_PAGES_CAP;
  const { after: afterEpoch, before: beforeEpoch } = window;

  for (let page = 1; page <= maxPages; page++) {
    let token: string | null = null;
    let oauthBeforeList = 0;
    if (page === 1) {
      const t = await getStravaAccessTokenWithoutProactiveRefreshForUser(userId);
      token = t.token;
      oauthBeforeList = t.oauthRefreshCount;
    } else {
      token = await getValidStravaAccessTokenForUser(userId);
    }
    stravaOauthRefreshCalls += oauthBeforeList;

    if (!token) {
      await recordIngestError(supabase, userId, "Connect Strava first.");
      return {
        ok: false,
        error: "Connect Strava first — reconnect from My Races or Overview.",
        stravaOauthRefreshCalls,
        needStravaReconnect: true
      };
    }

    if (page === 1) {
      await ensureUserStravaProfileUrl(supabase, userId, token);
    }
    const { result: r, athleteActivitiesListHttpCalls, oauthTokenRefreshCalls } =
      await fetchAthleteActivitiesPageWithRefresh(
        token,
        {
          page,
          perPage: PER_PAGE,
          before: beforeEpoch,
          after: afterEpoch
        },
        userId
      );
    requestsMade += athleteActivitiesListHttpCalls;
    stravaOauthRefreshCalls += oauthTokenRefreshCalls;

    if (!r.ok && r.kind === "rate_limit") {
      stoppedForRateLimit = true;
      retryAfterSec = r.retryAfterSec;
      rateLimitSnap = await recordClassifiedStrava429(supabase, userId, r as unknown as StravaRateLimitPageResult, {
        scope: "strava.backfill.jump",
        firstEndpoint: "GET /api/v3/athlete/activities"
      });
      break;
    }

    if (!r.ok) {
      const msg = r.message || `Strava list error ${r.httpStatus}`;
      await recordIngestError(supabase, userId, msg);
      return {
        ok: false,
        error: msg,
        requestsMade,
        stravaOauthRefreshCalls,
        hadPersistBeforeRateLimit: allSummaries.length > 0
      };
    }

    const batch = r.data;
    if (batch.length === 0) break;

    allSummaries.push(...batch);
    totalRaw += batch.length;
    const { items, evals } = partitionSummariesForHistoricalBackfill(batch);
    logHistoricalBackfillImportEvalIfEnabled(userId, evals);
    totalEligible += items.length;
    const result = await upsertStravaSummariesForUser(supabase, userId, items);
    totalUpserted += result.upserted;
    totalSkipped += result.skippedUnchanged;
    totalErrors += result.errors;
    totalSkippedInvalid += result.skippedInvalid;
    totalWriteAttempts += result.writeAttempts;
    appendPersistFailures(totalPersistFailures, result.persistFailures);

    if (batch.length < PER_PAGE) break;
  }

  const hadPersistBeforeRateLimit = allSummaries.length > 0;

  if (stoppedForRateLimit && !hadPersistBeforeRateLimit) {
    return {
      ok: false,
      error: formatStravaRateLimitUserMessage(
        0,
        rateLimitSnap?.headers ?? {},
        rateLimitSnap?.retryAfterSec ?? retryAfterSec
      ),
      requestsMade,
      stravaOauthRefreshCalls,
      retryAfterSec,
      hadPersistBeforeRateLimit: false
    };
  }

  const rateLimitUserMessage = stoppedForRateLimit
    ? formatStravaRateLimitUserMessage(totalUpserted, rateLimitSnap?.headers ?? {}, retryAfterSec)
    : undefined;

  runfolioLog.info("strava.backfill", "jump_scan_done", {
    userId,
    rawFetched: totalRaw,
    eligibleInBatch: totalEligible,
    upserted: totalUpserted,
    skippedUnchanged: totalSkipped,
    skippedInvalid: totalSkippedInvalid,
    writeAttempts: totalWriteAttempts,
    errors: totalErrors,
    persistFailureSample: totalPersistFailures[0]?.kind,
    after: afterEpoch,
    before: beforeEpoch,
    stoppedForRateLimit
  });

  return {
    ok: true,
    mode: "backfill",
    jumpScan: true,
    backfillExhausted: false,
    rawFetched: totalRaw,
    eligibleInBatch: totalEligible,
    upserted: totalUpserted,
    skippedUnchanged: totalSkipped,
    errors: totalErrors,
    skippedInvalid: totalSkippedInvalid,
    writeAttempts: totalWriteAttempts,
    persistFailures: totalPersistFailures,
    requestsMade,
    stravaOauthRefreshCalls,
    stoppedForRateLimit,
    retryAfterSec,
    hadPersistBeforeRateLimit,
    rateLimitUserMessage
  };
}

async function runBackfillStravaHistory(
  userId: string,
  opts?: { maxPages?: number; jumpPreset?: StravaBackfillJumpPreset; supabase?: SupabaseClient }
): Promise<BackfillSyncResult> {
  const supabase = opts?.supabase ?? (await createClient());
  const ingestTable = await getStravaIngestStateTableStatus(supabase);
  if (!ingestTable.ok) {
    return { ok: false, error: ingestTable.message };
  }

  if (opts?.jumpPreset) {
    return runBackfillJumpScan(userId, epochWindowForJumpPreset(opts.jumpPreset), supabase);
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
      : Math.min(Math.max(opts?.maxPages ?? defaultMax, 1), BACKFILL_MAX_PAGES_CAP);
  const beforeEpoch = state?.backfill_before_epoch ?? undefined;
  const before = beforeEpoch != null && beforeEpoch > 0 ? beforeEpoch : undefined;
  const isFirstEverBackfillBatch = defaultMax === BACKFILL_FIRST_BATCH_MAX_PAGES;
  const afterEpoch =
    !isFirstEverBackfillBatch && before != null ? backfillAfterEpochForChunk(before) : undefined;

  if (isFirstEverBackfillBatch) {
    const waitSec = firstBackfillCooldownRemainingSec(state, STRAVA_FIRST_BACKFILL_COOLDOWN_SEC);
    if (waitSec > 0) {
      return {
        ok: false,
        error: `The first import can only be started once every ${STRAVA_FIRST_BACKFILL_COOLDOWN_SEC} seconds. Try again in ${waitSec} seconds so Strava quota can recover.`
      };
    }
    await markFirstBackfillAttemptNow(supabase, userId);
  }

  let totalUpserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let totalSkippedInvalid = 0;
  let totalWriteAttempts = 0;
  const totalPersistFailures: StravaPersistFailure[] = [];
  let totalRaw = 0;
  let totalEligible = 0;
  const allSummaries: StravaSummaryActivityJson[] = [];
  let requestsMade = 0;
  let stravaOauthRefreshCalls = 0;
  let stoppedForRateLimit = false;
  let retryAfterSec: number | null = null;
  let rateLimitSnap: { headers: Record<string, string>; retryAfterSec: number | null } | null = null;

  for (let page = 1; page <= maxPages; page++) {
    let token: string | null = null;
    let oauthBeforeList = 0;
    if (page === 1) {
      const t = await getStravaAccessTokenWithoutProactiveRefreshForUser(userId);
      token = t.token;
      oauthBeforeList = t.oauthRefreshCount;
    } else {
      token = await getValidStravaAccessTokenForUser(userId);
    }
    stravaOauthRefreshCalls += oauthBeforeList;

    if (!token) {
      await recordIngestError(supabase, userId, "Connect Strava first.");
      return {
        ok: false,
        error: "Connect Strava first — reconnect from My Races or Overview.",
        stravaOauthRefreshCalls,
        needStravaReconnect: true
      };
    }

    if (page === 1) {
      await ensureUserStravaProfileUrl(supabase, userId, token);
    }
    const { result: r, athleteActivitiesListHttpCalls, oauthTokenRefreshCalls } =
      await fetchAthleteActivitiesPageWithRefresh(
        token,
        {
          page,
          perPage: PER_PAGE,
          ...(before != null ? { before } : {}),
          ...(afterEpoch != null ? { after: afterEpoch } : {})
        },
        userId
      );
    requestsMade += athleteActivitiesListHttpCalls;
    stravaOauthRefreshCalls += oauthTokenRefreshCalls;

    if (isFirstEverBackfillBatch && page === 1) {
      const rlMeta =
        !r.ok && r.kind === "rate_limit"
          ? classifyStrava429FromHeaders(r.rateLimitHeaders, r.retryAfterSec)
          : null;
      runfolioLog.info("strava.backfill", "first_list_response", {
        userId,
        firstEndpoint: "GET /api/v3/athlete/activities",
        proactiveListOauthSkipped: true,
        oauthRefreshCallsBeforeFirstList: oauthBeforeList,
        oauthRefreshCallsInListHelper: oauthTokenRefreshCalls,
        httpStatus: r.httpStatus,
        rateLimitHeaders: stravaHeadersForLog(r.rateLimitHeaders),
        activitiesReturned: r.ok ? r.data.length : null,
        listOk: r.ok,
        listKind: r.ok ? "success" : r.kind,
        failureBeforeFirstPersist: !(r.ok && r.data.length > 0),
        rlInferredKind: rlMeta?.kind,
        rlInferReason: rlMeta?.inferReason,
        rlUntilIso: rlMeta?.untilIso
      });
    }

    if (!r.ok && r.kind === "rate_limit") {
      stoppedForRateLimit = true;
      retryAfterSec = r.retryAfterSec;
      rateLimitSnap = await recordClassifiedStrava429(supabase, userId, r as unknown as StravaRateLimitPageResult, {
        scope: "strava.backfill",
        firstEndpoint: "GET /api/v3/athlete/activities"
      });
      runfolioLog.warn("strava.backfill", "rate_limit", {
        userId,
        page,
        requestsMade,
        stravaOauthRefreshCalls,
        hadPersistBeforeRateLimit: allSummaries.length > 0,
        retryAfterSec,
        failurePhase: allSummaries.length > 0 ? "after_first_persist" : "before_first_persist"
      });
      break;
    }

    if (!r.ok) {
      const msg = r.message || `Strava list error ${r.httpStatus}`;
      await recordIngestError(supabase, userId, msg);
      return {
        ok: false,
        error: msg,
        requestsMade,
        stravaOauthRefreshCalls,
        hadPersistBeforeRateLimit: allSummaries.length > 0
      };
    }

    const batch = r.data;
    if (batch.length === 0) break;

    allSummaries.push(...batch);
    totalRaw += batch.length;
    const { items, evals } = partitionSummariesForHistoricalBackfill(batch);
    logHistoricalBackfillImportEvalIfEnabled(userId, evals);
    totalEligible += items.length;
    const result = await upsertStravaSummariesForUser(supabase, userId, items);
    totalUpserted += result.upserted;
    totalSkipped += result.skippedUnchanged;
    totalErrors += result.errors;
    totalSkippedInvalid += result.skippedInvalid;
    totalWriteAttempts += result.writeAttempts;
    appendPersistFailures(totalPersistFailures, result.persistFailures);

    if (isFirstEverBackfillBatch && page === 1) {
      runfolioLog.info("strava.backfill", "first_page_persisted", {
        userId,
        qualifyingActivities: items.length,
        upserted: result.upserted,
        skippedUnchanged: result.skippedUnchanged,
        skippedInvalid: result.skippedInvalid,
        writeAttempts: result.writeAttempts,
        errors: result.errors,
        persistFailureKinds: result.persistFailures.map((f) => f.kind).join(","),
        failurePhase: "after_first_list_ok"
      });
    }

    runfolioLog.info("strava.backfill", "page_persisted", {
      userId,
      page,
      requestsMade,
      batchLen: batch.length,
      eligible: items.length,
      upserted: result.upserted,
      skippedUnchanged: result.skippedUnchanged,
      skippedInvalid: result.skippedInvalid,
      writeAttempts: result.writeAttempts,
      errors: result.errors,
      persistFailureKinds: result.persistFailures.map((f) => f.kind).join(",")
    });

    if (batch.length < PER_PAGE) break;
  }

  const hadPersistBeforeRateLimit = allSummaries.length > 0;

  if (stoppedForRateLimit && !hadPersistBeforeRateLimit) {
    return {
      ok: false,
      error: formatStravaRateLimitUserMessage(
        0,
        rateLimitSnap?.headers ?? {},
        rateLimitSnap?.retryAfterSec ?? retryAfterSec
      ),
      requestsMade,
      stravaOauthRefreshCalls,
      retryAfterSec,
      hadPersistBeforeRateLimit: false
    };
  }

  if (allSummaries.length === 0 && !stoppedForRateLimit) {
    if (afterEpoch != null) {
      await upsertIngestStateBackfill(supabase, userId, {
        nextBeforeEpoch: afterEpoch,
        exhausted: false,
        alsoBumpIncrementalEpoch: null
      });
      return {
        ok: true,
        mode: "backfill",
        upserted: 0,
        skippedUnchanged: 0,
        errors: 0,
        skippedInvalid: 0,
        writeAttempts: 0,
        persistFailures: [],
        backfillExhausted: false,
        rawFetched: 0,
        eligibleInBatch: 0,
        requestsMade,
        stravaOauthRefreshCalls,
        stoppedForRateLimit: false,
        retryAfterSec: null,
        hadPersistBeforeRateLimit: false
      };
    }
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
      skippedInvalid: 0,
      writeAttempts: 0,
      persistFailures: [],
      backfillExhausted: true,
      rawFetched: 0,
      eligibleInBatch: 0,
      requestsMade,
      stravaOauthRefreshCalls,
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
    ? formatStravaRateLimitUserMessage(totalUpserted, rateLimitSnap?.headers ?? {}, retryAfterSec)
    : undefined;

  if (stoppedForRateLimit) {
    runfolioLog.warn("strava.backfill", "batch_done_rate_limited_after_persist", {
      userId,
      requestsMade,
      stravaOauthRefreshCalls,
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
    skippedInvalid: totalSkippedInvalid,
    writeAttempts: totalWriteAttempts,
    persistFailures: totalPersistFailures,
    requestsMade,
    stravaOauthRefreshCalls,
    stoppedForRateLimit,
    retryAfterSec,
    hadPersistBeforeRateLimit,
    rateLimitUserMessage
  };
}
