import { searchCanonicalRacesActive } from "@/lib/races/canonical/repository";
import type { CanonicalRace, CanonicalSearchFilters, SearchableRaceRow } from "@/lib/races/canonical/types";

export function toSearchableRaceRow(r: CanonicalRace): SearchableRaceRow {
  const parts = [r.city, r.region, r.country].filter((x) => Boolean(x?.trim()));
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    locationLabel: parts.join(", "),
    startDate: r.startDate,
    distanceKm: r.distanceKm,
    elevationGainM: r.elevationGainM,
    logoUrl: r.logoUrl,
    heroImageUrl: r.heroImageUrl,
    raceType: r.raceType,
    surfaceType: r.surfaceType,
    categoryTags: r.categoryTags,
    completenessScore: r.completenessScore,
    qualityScore: r.qualityScore
  };
}

/**
 * Frontend-facing search: only active, sufficiently complete canonical races.
 */
export async function searchCanonicalRacesForFrontend(
  filters: CanonicalSearchFilters
): Promise<{ ok: true; races: SearchableRaceRow[] } | { ok: false; error: string }> {
  const res = await searchCanonicalRacesActive(filters);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, races: res.data.map(toSearchableRaceRow) };
}
