import { describe, expect, it } from "vitest";
import {
  deriveBackfillUxPhase,
  hasServerRecordedStravaBackfillBatch,
  type StravaBackfillProgress,
  type StravaIngestStateForBackfill
} from "../strava-backfill-model";

const baseState = (over: Partial<StravaIngestStateForBackfill>): StravaIngestStateForBackfill => ({
  backfill_batches_completed: 0,
  backfill_exhausted: false,
  last_rate_limit_at: null,
  last_error: null,
  updated_at: new Date().toISOString(),
  ...over
});

describe("deriveBackfillUxPhase", () => {
  it("returns partial when last_backfill_at is set even if batch counter is 0", () => {
    const phase = deriveBackfillUxPhase(
      baseState({
        last_backfill_at: "2026-04-01T12:00:00.000Z",
        backfill_batches_completed: 0
      }),
      0
    );
    expect(phase).toBe("partial");
  });

  it("returns partial when backfill_before_epoch is set", () => {
    const phase = deriveBackfillUxPhase(
      baseState({
        backfill_before_epoch: 1_700_000_000,
        backfill_batches_completed: 0,
        last_backfill_at: null
      }),
      0
    );
    expect(phase).toBe("partial");
  });

  it("returns ready when no ingest progress signals exist", () => {
    const phase = deriveBackfillUxPhase(baseState({}), 0);
    expect(phase).toBe("ready");
  });
});

describe("hasServerRecordedStravaBackfillBatch", () => {
  const baseProgress = (over: Partial<StravaBackfillProgress>): StravaBackfillProgress => ({
    phase: "ready",
    syncedActivityCount: 0,
    backfillBatchesCompleted: 0,
    backfillBeforeEpoch: null,
    backfillExhausted: false,
    moreHistoryAvailable: true,
    lastBackfillAt: null,
    lastRateLimitAt: null,
    lastError: null,
    stravaRateLimitKind: null,
    stravaRateLimitUntil: null,
    updatedAt: null,
    ingestStateTableAvailable: true,
    ...over
  });

  it("is true when lastBackfillAt is set", () => {
    expect(
      hasServerRecordedStravaBackfillBatch(
        baseProgress({ lastBackfillAt: "2026-01-01T00:00:00.000Z" })
      )
    ).toBe(true);
  });

  it("is true when backfillBeforeEpoch is set", () => {
    expect(hasServerRecordedStravaBackfillBatch(baseProgress({ backfillBeforeEpoch: 123 }))).toBe(true);
  });

  it("is false when ingest table unavailable", () => {
    expect(
      hasServerRecordedStravaBackfillBatch(
        baseProgress({ ingestStateTableAvailable: false, lastBackfillAt: "2026-01-01T00:00:00.000Z" })
      )
    ).toBe(false);
  });
});
