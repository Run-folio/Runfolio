import type { NormalizedRace, RaceIngestSource } from "@/lib/races/types/normalized";

/** Higher = wins field conflicts during merge */
const SOURCE_PRIORITY: Record<RaceIngestSource, number> = {
  raceresult: 100,
  active: 80,
  runsignup: 70,
  chronotrack: 60,
  utmb_catalog: 50,
  utmb_ws: 55,
  mock: 15,
  manual: 40
};

export function providerPriority(source: RaceIngestSource): number {
  return SOURCE_PRIORITY[source] ?? 0;
}

function longerString(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a.length >= b.length ? a : b;
}

/**
 * Merge two normalized rows that describe the same real-world event.
 * Prefers richer metadata and official-looking assets (logos) from higher-priority sources.
 */
export function mergeNormalizedRaces(a: NormalizedRace, b: NormalizedRace): NormalizedRace {
  const [first, second] =
    providerPriority(a.source) >= providerPriority(b.source) ? [a, b] : [b, a];

  return {
    ...first,
    description: longerString(first.description, second.description),
    logoUrl: first.logoUrl ?? second.logoUrl,
    heroImageUrl: first.heroImageUrl ?? second.heroImageUrl,
    officialUrl: first.officialUrl ?? second.officialUrl,
    registrationUrl: first.registrationUrl ?? second.registrationUrl,
    organizerName: first.organizerName ?? second.organizerName,
    venue: first.venue ?? second.venue,
    latitude: first.latitude ?? second.latitude,
    longitude: first.longitude ?? second.longitude,
    endDate: first.endDate ?? second.endDate,
    timezone: first.timezone ?? second.timezone,
    distanceKm: first.distanceKm ?? second.distanceKm,
    elevationGainM: first.elevationGainM ?? second.elevationGainM,
    raceType: first.raceType ?? second.raceType,
    surfaceType: first.surfaceType ?? second.surfaceType,
    utmbIndexEligible: first.utmbIndexEligible ?? second.utmbIndexEligible,
    utmbCategory: first.utmbCategory ?? second.utmbCategory,
    isTrail: first.isTrail ?? second.isTrail,
    isRoad: first.isRoad ?? second.isRoad,
    isUltra: first.isUltra ?? second.isUltra,
    categoryTags: [...new Set([...first.categoryTags, ...second.categoryTags])].slice(0, 32),
    rawPayload: {
      merged: true,
      winner: first.source,
      layers: [first.rawPayload, second.rawPayload].filter(Boolean)
    } as Record<string, unknown>
  };
}
