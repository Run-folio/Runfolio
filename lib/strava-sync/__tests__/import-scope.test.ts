import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const catalogMock = vi.hoisted(() => vi.fn(() => false));

vi.mock("@/lib/known-race-match", () => ({
  hasStrongCatalogMatchForStravaSummary: (...args: unknown[]) => catalogMock(...args)
}));

import {
  evaluateHistoricalBackfillImport,
  filterSummariesForPersist,
  partitionSummariesForHistoricalBackfill
} from "../import-scope";
import type { StravaSummaryActivityJson } from "@/lib/strava-api";

function row(
  o: Pick<StravaSummaryActivityJson, "id" | "name" | "distance" | "start_date"> &
    Partial<StravaSummaryActivityJson>
): StravaSummaryActivityJson {
  return {
    moving_time: 3600,
    type: "Run",
    sport_type: "Run",
    ...o
  };
}

describe("historical backfill import eval", () => {
  beforeEach(() => {
    catalogMock.mockReset();
    catalogMock.mockReturnValue(false);
    delete process.env.STRAVA_BACKFILL_RELAXED_DEBUG;
    delete process.env.STRAVA_BACKFILL_IMPORT_DEBUG;
  });

  afterEach(() => {
    delete process.env.STRAVA_BACKFILL_RELAXED_DEBUG;
  });

  it("accepts ≥40 km runs without title or catalog", () => {
    const e = evaluateHistoricalBackfillImport(
      row({
        id: 1,
        name: "Morning Run",
        distance: 42_195,
        start_date: "2024-10-13T14:00:00Z"
      })
    );
    expect(e.final_decision).toBe("accepted");
    expect(e.passes_distance_threshold).toBe(true);
    expect(e.passes_title_signal).toBe(false);
    expect(e.rejection_reasons).toEqual([]);
    expect(catalogMock).not.toHaveBeenCalled();
  });

  it("rejects sub-40 km without title or catalog (Chicago-style blocked path)", () => {
    const e = evaluateHistoricalBackfillImport(
      row({
        id: 2,
        name: "October long run",
        distance: 38_000,
        start_date: "2024-10-13T14:00:00Z"
      })
    );
    expect(e.final_decision).toBe("rejected");
    expect(e.passes_distance_threshold).toBe(false);
    expect(e.passes_title_signal).toBe(false);
    expect(e.catalog_match_found).toBe(false);
    expect(e.rejection_reasons).toEqual([
      "distance_below_threshold",
      "no_title_signal",
      "no_catalog_match"
    ]);
  });

  it("accepts sub-40 km when title matches marathon pattern", () => {
    const e = evaluateHistoricalBackfillImport(
      row({
        id: 3,
        name: "Bank of America Chicago Marathon",
        distance: 38_000,
        start_date: "2024-10-13T14:00:00Z"
      })
    );
    expect(e.final_decision).toBe("accepted");
    expect(e.passes_title_signal).toBe(true);
    expect(e.rejection_reasons).toEqual([]);
  });

  it("accepts sub-40 km via catalog when title is weak", () => {
    catalogMock.mockReturnValue(true);
    const e = evaluateHistoricalBackfillImport(
      row({
        id: 4,
        name: "Race",
        distance: 38_000,
        start_date: "2024-10-13T14:00:00Z"
      })
    );
    expect(e.final_decision).toBe("accepted");
    expect(e.catalog_match_found).toBe(true);
    expect(catalogMock).toHaveBeenCalled();
  });

  it("rejects unsupported sport even at marathon distance", () => {
    const e = evaluateHistoricalBackfillImport(
      row({
        id: 5,
        name: "Chicago Marathon",
        distance: 42_195,
        start_date: "2024-10-13T14:00:00Z",
        type: "Ride",
        sport_type: "Ride"
      })
    );
    expect(e.final_decision).toBe("rejected");
    expect(e.rejection_reasons).toEqual(["type_not_supported"]);
  });

  it("STRAVA_BACKFILL_RELAXED_DEBUG accepts 35 km without title or catalog", () => {
    process.env.STRAVA_BACKFILL_RELAXED_DEBUG = "1";
    const e = evaluateHistoricalBackfillImport(
      row({
        id: 6,
        name: "Long run",
        distance: 35_000,
        start_date: "2024-10-13T14:00:00Z"
      })
    );
    expect(e.relaxed_debug).toBe(true);
    expect(e.final_decision).toBe("accepted");
    expect(e.passes_distance_threshold).toBe(true);
    expect(catalogMock).not.toHaveBeenCalled();
  });

  it("partition + filter agree for historical_backfill", () => {
    const batch = [
      row({ id: 10, name: "A", distance: 42_000, start_date: "2020-01-01T12:00:00Z" }),
      row({ id: 11, name: "B", distance: 20_000, start_date: "2020-01-02T12:00:00Z" })
    ];
    const { items } = partitionSummariesForHistoricalBackfill(batch);
    const filtered = filterSummariesForPersist(batch, "historical_backfill");
    expect(items.map((x) => x.raw.id)).toEqual(filtered.map((x) => x.raw.id));
    expect(items).toHaveLength(1);
  });
});
