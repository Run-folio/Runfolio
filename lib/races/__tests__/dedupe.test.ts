import { describe, expect, it } from "vitest";
import { areLikelyDuplicateRaces, dedupeNormalizedRaces, normalizeRaceName } from "@/lib/races/dedupe";
import type { NormalizedRace } from "@/lib/races/types/normalized";

function baseRace(over: Partial<NormalizedRace>): NormalizedRace {
  return {
    id: "utmb_catalog:x",
    source: "utmb_catalog",
    sourceRaceId: "x",
    name: "Test Ultra",
    slug: "test-ultra",
    description: null,
    organizerName: null,
    officialUrl: null,
    registrationUrl: null,
    logoUrl: null,
    heroImageUrl: null,
    country: "France",
    region: null,
    city: "Chamonix",
    venue: null,
    latitude: null,
    longitude: null,
    startDate: "2025-08-29",
    endDate: null,
    timezone: null,
    distanceKm: 100,
    elevationGainM: 6000,
    raceType: null,
    surfaceType: "trail",
    categoryTags: [],
    difficultyScore: null,
    utmbIndexEligible: null,
    utmbCategory: null,
    isTrail: true,
    isRoad: false,
    isUltra: true,
    createdAt: null,
    updatedAt: null,
    rawPayload: null,
    ...over
  };
}

describe("normalizeRaceName", () => {
  it("strips diacritics and punctuation", () => {
    expect(normalizeRaceName("UTMB® Mont-Blanc")).toContain("utmb");
  });
});

describe("areLikelyDuplicateRaces", () => {
  it("matches same name date location distance", () => {
    const a = baseRace({ id: "a:1", name: "UTMB Mont Blanc", sourceRaceId: "1" });
    const b = baseRace({
      id: "raceresult:9",
      source: "raceresult",
      sourceRaceId: "9",
      name: "UTMB Mont Blanc Ultra Trail",
      logoUrl: "https://x/logo.png"
    });
    expect(areLikelyDuplicateRaces(a, b)).toBe(true);
  });

  it("rejects different countries when both set", () => {
    const a = baseRace({ country: "France" });
    const b = baseRace({ id: "b:2", source: "active", sourceRaceId: "2", country: "USA" });
    expect(areLikelyDuplicateRaces(a, b)).toBe(false);
  });
});

describe("dedupeNormalizedRaces", () => {
  it("merges duplicates and keeps logo from higher-priority source", () => {
    const catalog = baseRace({
      id: "utmb_catalog:disc-utmb",
      sourceRaceId: "disc-utmb",
      name: "UTMB Mont Blanc",
      logoUrl: null
    });
    const rr = baseRace({
      id: "raceresult:99",
      source: "raceresult",
      sourceRaceId: "99",
      name: "UTMB Mont Blanc",
      logoUrl: "https://cdn.example/logo.png"
    });
    const out = dedupeNormalizedRaces([catalog, rr]);
    expect(out).toHaveLength(1);
    expect(out[0]!.logoUrl).toBe("https://cdn.example/logo.png");
  });
});
