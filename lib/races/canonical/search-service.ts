import { searchCanonicalRacesActive } from "@/lib/races/canonical/repository";
import type { CanonicalRace, CanonicalSearchFilters, SearchableRaceRow } from "@/lib/races/canonical/types";

function buildDateSummary(startDate: string | null): string {
  if (!startDate?.trim()) return "Undated / series";
  const ymd = startDate.slice(0, 10);
  if (ymd.length !== 10) return startDate.trim();
  try {
    const d = new Date(`${ymd}T12:00:00Z`);
    if (Number.isNaN(d.getTime())) return ymd;
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(d);
  } catch {
    return ymd;
  }
}

export function toSearchableRaceRow(r: CanonicalRace): SearchableRaceRow {
  const parts = [r.city, r.region, r.country].filter((x) => Boolean(x?.trim()));
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    locationLabel: parts.join(", ") || "—",
    startDate: r.startDate,
    dateSummary: buildDateSummary(r.startDate),
    distanceKm: r.distanceKm,
    elevationGainM: r.elevationGainM,
    logoUrl: r.logoUrl,
    heroImageUrl: r.heroImageUrl,
    fallbackImageUrl: r.fallbackImageUrl,
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
