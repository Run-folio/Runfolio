import { describe, expect, it } from "vitest";
import {
  catalogRecordsForDocs,
  discoverRaces,
  getDiscoverCatalogSummary
} from "@/lib/catalog/build-catalog";
import { validateDiscoverCatalogRecords } from "@/lib/catalog/discover-catalog-validate";

describe("discover catalog validation", () => {
  it("merged catalog has no validation errors", () => {
    const issues = validateDiscoverCatalogRecords(catalogRecordsForDocs);
    const errors = issues.filter((i) => i.level === "error");
    expect(errors).toEqual([]);
  });

  it("summary reflects non-empty curated catalog", () => {
    const s = getDiscoverCatalogSummary();
    expect(s.totalDiscoverRaces).toBe(discoverRaces.length);
    expect(s.totalDiscoverRaces).toBeGreaterThan(80);
    expect(s.withStructuredCountry).toBeGreaterThan(50);
    expect(s.withAliases).toBeGreaterThan(70);
    expect(s.validationErrorCount).toBe(0);
  });
});
