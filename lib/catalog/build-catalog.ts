import type { CatalogRaceRecord } from "@/lib/catalog/types";
import { EPIC_LEGACY_RECORDS } from "@/lib/catalog/epic-legacy";
import { GLOBAL_TRAIL_ULTRA_RECORDS } from "@/lib/catalog/global-trail-ultras";
import { ROAD_MAJOR_RECORDS } from "@/lib/catalog/road-majors";
import { UTMB_WORLD_SERIES_RECORDS } from "@/lib/catalog/utmb-world-series";
import type { DiscoverRace } from "@/lib/discover-race-schema";

/**
 * Merge order = precedence (first occurrence wins). Add new modules by appending to `CATALOG_SOURCES`.
 */
const CATALOG_SOURCES: CatalogRaceRecord[][] = [
  ROAD_MAJOR_RECORDS,
  UTMB_WORLD_SERIES_RECORDS,
  GLOBAL_TRAIL_ULTRA_RECORDS,
  EPIC_LEGACY_RECORDS
];

function dedupeCatalog(records: CatalogRaceRecord[][]): CatalogRaceRecord[] {
  const seen = new Set<string>();
  const out: CatalogRaceRecord[] = [];
  for (const chunk of records) {
    for (const r of chunk) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
  }
  return out;
}

export function recordToDiscoverRace(r: CatalogRaceRecord): DiscoverRace {
  return {
    id: r.id,
    name: r.name,
    location: r.location,
    distance_km: r.distance_km,
    surface: r.surface,
    group: r.group,
    multi_day: r.multi_day,
    aliases: r.aliases,
    event_group: r.event_group,
    typical_months: r.typical_months,
    elevation_m_est: r.elevation_m_est ?? null,
    tags: r.tags,
    distance_variants_km: r.distance_variants_km,
    match_boost: r.match_boost,
    region: r.region,
    catalog_visibility: r.catalog_visibility ?? "public",
    source: r.source
  };
}

const MERGED_RECORDS = dedupeCatalog(CATALOG_SOURCES);

/** Full merged catalog (matching, trophy logic, activity dropdowns that need aliases). */
export const discoverRaces: DiscoverRace[] = MERGED_RECORDS.map(recordToDiscoverRace);

/** Find a Race & public race library — excludes `match_only` rows. */
export function getPublicCatalogRaces(): DiscoverRace[] {
  return discoverRaces.filter((r) => r.catalog_visibility !== "match_only");
}

/** Build alias map for the matcher (merged with any legacy hardcoded extras in known-race-match). */
export function buildCatalogAliasMap(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const r of MERGED_RECORDS) {
    const list: string[] = [];
    if (r.aliases?.length) list.push(...r.aliases);
    const nameTokens = r.name
      .toLowerCase()
      .split(/[\s/]+/)
      .filter((w) => w.length > 2);
    for (const t of nameTokens) {
      if (!list.includes(t)) list.push(t);
    }
    out[r.id] = list;
  }
  return out;
}

export function buildCatalogTypicalMonths(): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const r of MERGED_RECORDS) {
    if (r.typical_months?.length) out[r.id] = r.typical_months;
  }
  return out;
}

export { MERGED_RECORDS as catalogRecordsForDocs };
