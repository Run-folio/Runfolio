import { describe, expect, it } from "vitest";
import { mergeNormalizedRaces, providerPriority } from "@/lib/races/enrichment";
import type { NormalizedRace } from "@/lib/races/types/normalized";

const minimal = (id: string, source: NormalizedRace["source"], name: string): NormalizedRace => ({
  id,
  source,
  sourceRaceId: "s",
  name,
  slug: "x",
  description: null,
  organizerName: null,
  officialUrl: null,
  registrationUrl: null,
  logoUrl: null,
  heroImageUrl: null,
  country: null,
  region: null,
  city: null,
  venue: null,
  latitude: null,
  longitude: null,
  startDate: null,
  endDate: null,
  timezone: null,
  distanceKm: 42,
  elevationGainM: null,
  raceType: null,
  surfaceType: null,
  categoryTags: [],
  difficultyScore: null,
  utmbIndexEligible: null,
  utmbCategory: null,
  isTrail: null,
  isRoad: null,
  isUltra: null,
  createdAt: null,
  updatedAt: null,
  rawPayload: null
});

describe("providerPriority", () => {
  it("ranks raceresult above catalog", () => {
    expect(providerPriority("raceresult")).toBeGreaterThan(providerPriority("utmb_catalog"));
  });
});

describe("mergeNormalizedRaces", () => {
  it("prefers longer description from either side", () => {
    const a = minimal("a", "utmb_catalog", "Race");
    a.description = "Short";
    const b = minimal("b", "raceresult", "Race");
    b.description = "Much longer official copy about the event.";
    const m = mergeNormalizedRaces(a, b);
    expect(m.description).toBe("Much longer official copy about the event.");
  });
});
