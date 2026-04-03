import { describe, expect, it } from "vitest";
import { searchRacesUnified } from "@/lib/races/service";

describe("searchRacesUnified", () => {
  it("returns utmb_catalog results without failing when stubs are empty", async () => {
    const res = await searchRacesUnified({
      query: "UTMB",
      providers: ["utmb_catalog"],
      limitPerProvider: 20
    });
    expect(res.ok).toBe(true);
    expect(res.races.length).toBeGreaterThan(0);
    expect(res.providerErrors.filter((e) => e.provider === "utmb_catalog")).toHaveLength(0);
  });

  it("returns a consistent envelope for multi-provider calls", async () => {
    const res = await searchRacesUnified({
      query: "marathon",
      limitPerProvider: 5
    });
    expect(res.ok).toBe(true);
    expect(Array.isArray(res.races)).toBe(true);
    expect(Array.isArray(res.providerErrors)).toBe(true);
  });
});
