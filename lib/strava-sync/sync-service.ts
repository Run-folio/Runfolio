import {
  BACKFILL_DEFAULT_MAX_PAGES,
  fetchStravaBackfillBatch,
  fetchStravaIncrementalSummaries,
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
import { runfolioLog } from "@/lib/runfolio-log";

const AFTER_OVERLAP_SEC = 7200;

function isUnauthorizedMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("401") || m.includes("unauthorized");
}

function isRateLimitMessage(msg: string): boolean {
  return msg.toLowerCase().includes("rate limit");
}

async function withListRecovery<T>(
  userId: string,
  run: (access: string) => Promise<T>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  let access = await getValidStravaAccessToken();
  if (!access) {
    return { ok: false, error: "Connect Strava first." };
  }
  try {
    const data = await run(access);
    return { ok: true, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Strava list failed";
    const supabase = await createClient();
    if (isRateLimitMessage(message)) {
      await recordRateLimitHint(supabase, userId);
    }
    const cred = getStravaClientCredentials();
    const jar = await getStravaTokensFromCookies();
    const refresh = jar.refreshToken ?? process.env.STRAVA_REFRESH_TOKEN?.trim();
    if (cred && refresh && isUnauthorizedMessage(message)) {
      try {
        const t = await refreshStravaAccessToken(refresh, cred.clientId, cred.clientSecret);
        await persistStravaTokensToCookies(t);
        const data = await run(t.access_token);
        return { ok: true, data };
      } catch (e2) {
        runfolioLog.warn("strava.sync", "refresh failed", {
          detail: e2 instanceof Error ? e2.message : "unknown"
        });
        return { ok: false, error: "Strava session expired — reconnect." };
      }
    }
    runfolioLog.warn("strava.sync", message);
    return { ok: false, error: message };
  }
}

export type IncrementalSyncResult =
  | (SyncSummary & { ok: true; mode: "incremental" })
  | { ok: false; error: string; needBackfill?: boolean };

/**
 * Incremental only — Strava activities **after** stored high-water (or newest synced row for legacy users).
 * Empty sync table: user must run {@link backfillStravaHistoryForUserId} first.
 */
export async function syncStravaActivitiesForUserId(userId: string): Promise<IncrementalSyncResult> {
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

  const recovered = await withListRecovery(userId, (token) =>
    fetchStravaIncrementalSummaries(token, afterEpoch)
  );
  if (!recovered.ok) {
    await recordIngestError(supabase, userId, recovered.error);
    return recovered;
  }

  const summaries = recovered.data;
  const items = filterSummariesForPersist(summaries, "incremental");
  const result = await upsertStravaSummariesForUser(supabase, userId, items);

  const maxEp = maxStartEpochFromSummaries(summaries);
  if (summaries.length > 0 && maxEp != null) {
    await upsertIngestStateIncremental(supabase, userId, maxEp);
  } else {
    await touchIncrementalSyncOnly(supabase, userId);
  }

  return { ok: true, mode: "incremental", ...result };
}

export type BackfillSyncResult =
  | (SyncSummary & {
      ok: true;
      mode: "backfill";
      backfillExhausted: boolean;
      /** Raw Strava list rows returned for this batch (before local filter). */
      rawFetched: number;
      /** Rows that matched import rules and were passed to the DB upsert. */
      eligibleInBatch: number;
    })
  | { ok: false; error: string };

/**
 * Bounded historical backfill (resumable). Each call fetches at most `maxPages` list pages,
 * then advances `backfill_before_epoch` toward older activities.
 */
export async function backfillStravaHistoryForUserId(
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

  const maxPages = opts?.maxPages ?? BACKFILL_DEFAULT_MAX_PAGES;
  const beforeEpoch = state?.backfill_before_epoch ?? undefined;

  const recovered = await withListRecovery(userId, (token) =>
    fetchStravaBackfillBatch(token, {
      beforeEpoch: beforeEpoch ?? null,
      maxPages
    })
  );
  if (!recovered.ok) {
    await recordIngestError(supabase, userId, recovered.error);
    return recovered;
  }

  const summaries = recovered.data;
  if (summaries.length === 0) {
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
      eligibleInBatch: 0
    };
  }

  const items = filterSummariesForPersist(summaries, "historical_backfill");
  const result = await upsertStravaSummariesForUser(supabase, userId, items);

  const minEp = minStartEpochFromSummaries(summaries);
  const maxEp = maxStartEpochFromSummaries(summaries);
  const nextBefore = minEp != null ? minEp - 1 : null;

  await upsertIngestStateBackfill(supabase, userId, {
    nextBeforeEpoch: nextBefore,
    exhausted: false,
    alsoBumpIncrementalEpoch: maxEp
  });

  return {
    ok: true,
    mode: "backfill",
    backfillExhausted: false,
    rawFetched: summaries.length,
    eligibleInBatch: items.length,
    ...result
  };
}
