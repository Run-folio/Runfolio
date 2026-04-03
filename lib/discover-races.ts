export type { DiscoverRace } from "@/lib/discover-race-schema";
export * from "@/lib/discover-races-constants";
export {
  buildCatalogAliasMap,
  buildCatalogTypicalMonths,
  discoverRaces,
  getPublicCatalogRaces
} from "@/lib/catalog/build-catalog";

export type DistanceFilterId = "any" | "half" | "marathon" | "ultra" | "hundred_plus";

import type { DiscoverSurface } from "@/lib/discover-races-constants";
import type { DiscoverRace } from "@/lib/discover-race-schema";

export type SurfaceFilterId = "any" | DiscoverSurface;

export function formatDiscoverDistance(km: number, multiDay?: boolean): string {
  if (multiDay) return `${km} km (multi-stage)`;
  if (km >= 161 && km <= 165) return "100 mi";
  if (Math.abs(km - 42.2) < 2) return "Marathon";
  if (km < 30) return `${km} km`;
  return `${km} km`;
}

export function matchesDiscoverFilters(
  race: DiscoverRace,
  query: string,
  distance: DistanceFilterId,
  surface: SurfaceFilterId
): boolean {
  const q = query.trim().toLowerCase();
  if (q) {
    const aliasBlob = (race.aliases ?? []).join(" ");
    const official = race.official_name ?? "";
    const geoBits = [race.city, race.region_state, race.country].filter(Boolean).join(" ");
    const blob = `${race.name} ${official} ${race.location} ${geoBits} ${aliasBlob}`.toLowerCase();
    if (!blob.includes(q)) return false;
  }

  if (surface !== "any" && race.surface !== surface) return false;

  if (distance === "any") return true;
  const d = race.distance_km;
  const multi = race.multi_day === true;
  const variantMax = race.distance_variants_km?.length
    ? Math.max(d, ...race.distance_variants_km)
    : d;
  const variantMin = race.distance_variants_km?.length
    ? Math.min(d, ...race.distance_variants_km)
    : d;

  switch (distance) {
    case "half":
      return variantMax <= 25 && !multi;
    case "marathon":
      return variantMin > 25 && variantMax <= 50 && !multi;
    case "ultra":
      return !multi && variantMin > 50 && variantMax < 161;
    case "hundred_plus":
      return variantMax >= 161 || multi;
    default:
      return true;
  }
}
