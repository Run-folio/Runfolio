import { describe, expect, it } from "vitest";
import { normalizedMatchesCanonical, pickBestCanonicalMatch } from "@/lib/races/canonical/match";
import { mergeCanonicalFromNormalized, canonicalFromNormalizedSeed } from "@/lib/races/canonical/merge-canonical";
import type { CanonicalRace } from "@/lib/races/canonical/types";
import type { NormalizedRace } from "@/lib/races/types/normalized";

function norm(over: Partial<NormalizedRace>): NormalizedRace {
  return {
    id: "mock:x",
    source: "mock",
    sourceRaceId: "x",
    name: "Alpine Trail 50K",
    slug: "alpine-trail-50k",
    description: null,
    organizerName: null,
    officialUrl: null,
    registrationUrl: null,
    logoUrl: null,
    heroImageUrl: null,
    country: "US",
    region: null,
    city: "Denver",
    venue: null,
    latitude: null,
    longitude: null,
    startDate: "2026-09-01",
    endDate: null,
    timezone: null,
    distanceKm: 50,
    elevationGainM: 1000,
    raceType: "trail",
    surfaceType: "trail",
    categoryTags: [],
    difficultyScore: null,
    utmbIndexEligible: null,
    utmbCategory: null,
    isTrail: true,
    isRoad: false,
    isUltra: false,
    createdAt: null,
    updatedAt: null,
    rawPayload: null,
    ...over
  };
}

function canon(over: Partial<CanonicalRace>): CanonicalRace {
  const base = canonicalFromNormalizedSeed(norm({}), "alpine-trail-50k", "race-1", "2026-01-01T00:00:00.000Z");
  return { ...base, ...over };
}

describe("canonical match", () => {
  it("matches when name, date, distance, and location align", () => {
    const c = canon({ name: "Alpine Trail 50k", city: "Denver", country: "US", startDate: "2026-09-01", distanceKm: 50 });
    expect(normalizedMatchesCanonical(c, norm({}))).toBe(true);
  });

  it("rejects country mismatch", () => {
    const c = canon({ name: "Alpine Trail 50K", country: "France" });
    expect(normalizedMatchesCanonical(c, norm({ country: "US" }))).toBe(false);
  });

  it("picks higher completeness candidate", () => {
    const a = canon({ id: "a", completenessScore: 10, name: "Alpine Trail 50K" });
    const b = canon({ id: "b", completenessScore: 80, name: "Alpine Trail 50K" });
    const pick = pickBestCanonicalMatch(norm({}), [a, b]);
    expect(pick?.id).toBe("b");
  });
});

describe("canonical merge", () => {
  it("prefers longer description", () => {
    const c = canon({ description: "Short" });
    const merged = mergeCanonicalFromNormalized(c, norm({ description: "A much longer official description here." }), {
      incomingSource: "mock",
      incomingTrust: 50,
      existingTrustHint: 40
    });
    expect(merged.description?.length).toBeGreaterThan(5);
    expect(merged.description).toContain("much longer");
  });

  it("does not overwrite official URL with lower-trust empty", () => {
    const c = canon({ officialUrl: "https://event.example/race" });
    const merged = mergeCanonicalFromNormalized(c, norm({ officialUrl: null }), {
      incomingSource: "mock",
      incomingTrust: 100,
      existingTrustHint: 50
    });
    expect(merged.officialUrl).toBe("https://event.example/race");
  });

  it("respects curationLocked", () => {
    const c = canon({ name: "Locked Name", curationLocked: { name: true } });
    const merged = mergeCanonicalFromNormalized(c, norm({ name: "Other Name" }), {
      incomingSource: "mock",
      incomingTrust: 100,
      existingTrustHint: 0
    });
    expect(merged.name).toBe("Locked Name");
  });
});
