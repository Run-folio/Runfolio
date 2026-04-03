import type { NormalizedRace } from "@/lib/races/types/normalized";

/** Snapshot of mapped fields at import time for auditing / replays. */
export function mappedFieldsFromNormalized(n: NormalizedRace): Record<string, unknown> {
  return {
    name: n.name,
    sourceRaceId: n.sourceRaceId,
    startDate: n.startDate,
    endDate: n.endDate,
    country: n.country,
    region: n.region,
    city: n.city,
    distanceKm: n.distanceKm,
    elevationGainM: n.elevationGainM,
    officialUrl: n.officialUrl,
    logoUrl: n.logoUrl,
    raceType: n.raceType,
    surfaceType: n.surfaceType,
    categoryTags: n.categoryTags,
    isTrail: n.isTrail,
    isUltra: n.isUltra
  };
}
