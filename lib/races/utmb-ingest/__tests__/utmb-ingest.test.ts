import { describe, expect, it } from "vitest";
import { editionStartDateYmd } from "@/lib/races/utmb-ingest/edition-anchor";
import { inferUtmbIndexCategory } from "@/lib/races/utmb-ingest/utmb-category";
import { utmbRowToEditionNormalized } from "@/lib/races/utmb-ingest/to-normalized";
import type { UtmbIngestRow } from "@/lib/races/utmb-ingest/types";

describe("inferUtmbIndexCategory", () => {
  it("maps distances into UTMB-style buckets", () => {
    expect(inferUtmbIndexCategory(22)).toBe("20K");
    expect(inferUtmbIndexCategory(55)).toBe("50K");
    expect(inferUtmbIndexCategory(101)).toBe("100K");
    expect(inferUtmbIndexCategory(171)).toBe("100M");
  });
});

describe("editionStartDateYmd", () => {
  it("applies recurring month/day from anchor to a target year", () => {
    expect(
      editionStartDateYmd(2027, {
        id: "disc-x",
        edition_date_anchor_ymd: "2019-08-28",
        typical_months: [8]
      })
    ).toBe("2027-08-28");
  });

  it("is stable for the same series id (spread within month)", () => {
    const row = { id: "disc-ccc", typical_months: [8] as number[] };
    expect(editionStartDateYmd(2025, row)).toBe(editionStartDateYmd(2025, row));
    expect(editionStartDateYmd(2025, row)).toMatch(/^2025-08-\d{2}$/);
  });
});

describe("utmbRowToEditionNormalized", () => {
  it("uses stable source_race_id per year and attaches series id", () => {
    const row: UtmbIngestRow = {
      id: "disc-test",
      name: "Test Trail",
      location: "Somewhere",
      distance_km: 50,
      surface: "trail",
      group: "utmb",
      typical_months: [6],
      edition_date_quality: "month_typical"
    };
    const n = utmbRowToEditionNormalized(row, 2026, "00000000-0000-4000-8000-000000000001");
    expect(n).not.toBeNull();
    expect(n!.source).toBe("utmb_ws");
    expect(n!.sourceRaceId).toBe("disc-test:2026");
    expect(n!.canonicalSeriesId).toBe("00000000-0000-4000-8000-000000000001");
    expect(n!.startDate?.startsWith("2026-06-")).toBe(true);
    expect(n!.categoryTags).toContain("utmb_ws");
    expect(n!.categoryTags.some((t) => t.startsWith("edition_date_quality:"))).toBe(true);
  });
});
