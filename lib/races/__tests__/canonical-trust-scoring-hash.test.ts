import { describe, expect, it } from "vitest";
import { hashRawPayload } from "@/lib/races/canonical/raw-hash";
import { isUnchangedCanonicalPayload } from "@/lib/races/canonical/import-pipeline";
import {
  computeCompletenessScore,
  computeQualityFlags,
  recomputeCanonicalScores
} from "@/lib/races/canonical/scoring";
import { listSourceTrustOrder, sourceTrustRank } from "@/lib/races/canonical/source-trust";
import { canonicalFromNormalizedSeed } from "@/lib/races/canonical/merge-canonical";
import type { NormalizedRace } from "@/lib/races/types/normalized";

function norm(over: Partial<NormalizedRace>): NormalizedRace {
  return {
    id: "mock:x",
    source: "mock",
    sourceRaceId: "x",
    name: "Test",
    slug: "test",
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
    distanceKm: null,
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
    rawPayload: null,
    ...over
  };
}

describe("source trust ranking", () => {
  it("orders mock below manual and active", () => {
    const order = listSourceTrustOrder();
    expect(order.indexOf("raceresult")).toBeLessThan(order.indexOf("mock"));
    expect(sourceTrustRank("manual")).toBeGreaterThan(sourceTrustRank("mock"));
  });
});

describe("canonical scoring", () => {
  it("flags missing critical fields", () => {
    const r = recomputeCanonicalScores(
      canonicalFromNormalizedSeed(norm({ name: "" }), "x", "id1", "2026-01-01T00:00:00.000Z")
    );
    const flags = computeQualityFlags(r);
    expect(flags.missingName).toBe(true);
    expect(flags.missingDate).toBe(true);
  });

  it("raises completeness when core fields present", () => {
    const rich = canonicalFromNormalizedSeed(
      norm({
        name: "Ultra France",
        startDate: "2026-06-01",
        country: "France",
        city: "Chamonix",
        distanceKm: 100,
        officialUrl: "https://example.com",
        logoUrl: "https://example.com/l.png",
        latitude: 45.9,
        longitude: 6.8,
        description: "A sufficiently long description for the scoring threshold."
      }),
      "ultra-fr",
      "id2",
      "2026-01-01T00:00:00.000Z"
    );
    expect(computeCompletenessScore(rich)).toBeGreaterThan(60);
  });
});

describe("raw hash idempotency helper", () => {
  it("hashes key order independently", () => {
    expect(hashRawPayload({ z: 1, a: 2 })).toBe(hashRawPayload({ a: 2, z: 1 }));
  });

  it("treats null and empty payload consistently", () => {
    expect(hashRawPayload(null)).toBe(hashRawPayload(undefined));
    expect(hashRawPayload({})).toBeTruthy();
  });

  it("skips import when hash unchanged by default", () => {
    const h = hashRawPayload({ a: 1 });
    expect(isUnchangedCanonicalPayload(h, h, {})).toBe(true);
    expect(isUnchangedCanonicalPayload(h, h, { skipUnchangedPayload: false })).toBe(false);
  });
});
