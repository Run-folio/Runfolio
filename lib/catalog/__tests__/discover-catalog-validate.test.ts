import { describe, expect, it } from "vitest";
import { catalogRecordsForDocs } from "@/lib/catalog/build-catalog";
import { validateDiscoverCatalogRecords } from "@/lib/catalog/discover-catalog-validate";

describe("discover catalog validation", () => {
  it("merged catalog has no validation errors", () => {
    const issues = validateDiscoverCatalogRecords(catalogRecordsForDocs);
    const errors = issues.filter((i) => i.level === "error");
    expect(errors).toEqual([]);
  });
});
