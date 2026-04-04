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
  it("orders windows: last_12m is newest, then 12_24, then 24_36", () => {
    const a = epochWindowForJumpPreset("last_12m");
    const b = epochWindowForJumpPreset("months_12_24");
    const c = epochWindowForJumpPreset("months_24_36");
    expect(a.before).toBeGreaterThan(a.after);
    expect(b.before).toBeLessThanOrEqual(a.after);
    expect(c.before).toBeLessThanOrEqual(b.after);
  });
});
