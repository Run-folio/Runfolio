import { describe, expect, it } from "vitest";
import { epochWindowForJumpPreset } from "../backfill-jump-windows";
import { backfillAfterEpochForChunk, BACKFILL_DATE_CHUNK_SEC } from "../fetch-summaries";

describe("backfillAfterEpochForChunk", () => {
  it("returns undefined when before is too small for a full chunk", () => {
    expect(backfillAfterEpochForChunk(BACKFILL_DATE_CHUNK_SEC)).toBeUndefined();
  });

  it("returns before minus chunk when there is room", () => {
    const before = BACKFILL_DATE_CHUNK_SEC + 10_000;
    expect(backfillAfterEpochForChunk(before)).toBe(before - BACKFILL_DATE_CHUNK_SEC);
  });
});

describe("epochWindowForJumpPreset", () => {
  const PRESETS_NEWEST_TO_OLDEST_BAND = [
    "last_12m",
    "months_12_24",
    "months_24_36",
    "months_36_60",
    "months_60_plus"
  ] as const;

  it("each window has after < before", () => {
    for (const p of PRESETS_NEWEST_TO_OLDEST_BAND) {
      const w = epochWindowForJumpPreset(p);
      expect(w.before).toBeGreaterThan(w.after);
    }
  });

  it("bands chain: each older preset ends where the next newer band starts (no gaps at 365d boundaries)", () => {
    const windows = PRESETS_NEWEST_TO_OLDEST_BAND.map((p) => epochWindowForJumpPreset(p));
    for (let i = 0; i < windows.length - 1; i++) {
      const newer = windows[i];
      const older = windows[i + 1];
      expect(older.before).toBeLessThanOrEqual(newer.after);
    }
  });
});
