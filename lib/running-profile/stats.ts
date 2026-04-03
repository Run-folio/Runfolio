import type { Race } from "@/types";

export type RunningProfileStats = {
  racesCompleted: number;
  totalDistanceKm: number;
  totalElevationM: number;
  ultraFinishes: number;
  countriesRaced: number;
  careerHighlightCount: number;
  elevationKm: number;
};

const ULTRA_KM = 42.195;

/** Last comma-separated segment treated as country (same heuristic as profile stats). */
export function roughCountryFromLocation(location: string | null | undefined): string | null {
  if (!location?.trim()) return null;
  const parts = location.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  return parts[parts.length - 1] ?? null;
}

/** Derived stats from published profile races only (fast, no extra queries). */
export function computeRunningProfileStats(races: Race[]): RunningProfileStats {
  let totalDistanceKm = 0;
  let totalElevationM = 0;
  let ultraFinishes = 0;
  const countries = new Set<string>();
  let careerHighlightCount = 0;

  for (const r of races) {
    const dk = r.distance_km;
    if (typeof dk === "number" && Number.isFinite(dk) && dk > 0) {
      totalDistanceKm += dk;
      if (dk >= ULTRA_KM) ultraFinishes += 1;
    }
    const el = r.elevation_m;
    if (typeof el === "number" && Number.isFinite(el) && el > 0) {
      totalElevationM += el;
    }
    const c = roughCountryFromLocation(r.location);
    if (c) countries.add(c.toLowerCase());
    if (r.tag_career_highlight || r.profile_featured) careerHighlightCount += 1;
  }

  return {
    racesCompleted: races.length,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    totalElevationM: Math.round(totalElevationM),
    ultraFinishes,
    countriesRaced: countries.size,
    careerHighlightCount,
    elevationKm: Math.round((totalElevationM / 1000) * 10) / 10
  };
}
