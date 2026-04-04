import { describe, expect, it } from "vitest";
import {
  confidenceFromScore100,
  scoreActivityAgainstCanonical
} from "@/lib/strava-canonical-match/score-activity-canonical";
import type { CanonicalRace } from "@/lib/races/canonical/types";

function race(over: Partial<CanonicalRace>): CanonicalRace {
  return {
    id: "c1",
    slug: "stub-ultra",
    seriesId: null,
    name: "Alpine Valley Ultra 80K",
    description: null,
    longDescription: null,
    organizerName: null,
    officialUrl: null,
    registrationUrl: null,
    logoUrl: null,
    heroImageUrl: null,
    fallbackImageUrl: null,
    country: "France",
    region: "Haute-Savoie",
    city: "Chamonix",
    venue: null,
    latitude: 45.92,
    longitude: 6.87,
    startDate: "2026-08-15",
    endDate: null,
    timezone: null,
    distanceKm: 80,
    distanceOptionsKm: [],
    elevationGainM: 4500,
    raceType: "trail",
    surfaceType: "trail",
    categoryTags: [],
    difficultyScore: null,
    utmbIndexEligible: null,
    utmbCategory: null,
    isTrail: true,
    isRoad: false,
    isUltra: true,
    qualityScore: 70,
    completenessScore: 70,
    qualityFlags: {},
    status: "active",
    enrichmentStatus: "never",
    lastEnrichedAt: null,
    enrichmentMeta: {},
    curationLocked: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over
  };
}

describe("scoreActivityAgainstCanonical", () => {
  it("scores high when date, distance, geo, and name align", () => {
    const s = scoreActivityAgainstCanonical(
      {
        name: "Alpine Valley Ultra — training fatass",
        distanceKm: 79.5,
        elevationM: 4400,
        startDateYmd: "2026-08-15",
        city: "Chamonix",
        country: "France",
        latitude: 45.92,
        longitude: 6.87
      },
      race({})
    );
    expect(s.total).toBeGreaterThanOrEqual(65);
    expect(["high", "medium"]).toContain(confidenceFromScore100(s.total));
    expect(s.reasons.length).toBeGreaterThan(0);
  });

  it("scores low when date and distance disagree", () => {
    const s = scoreActivityAgainstCanonical(
      {
        name: "Easy coffee run",
        distanceKm: 8,
        elevationM: 50,
        startDateYmd: "2026-02-01",
        city: null,
        country: null,
        latitude: null,
        longitude: null
      },
      race({})
    );
    expect(s.total).toBeLessThan(48);
    expect(confidenceFromScore100(s.total)).toBe("low");
  });
});
