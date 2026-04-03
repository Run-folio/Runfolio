import type { CatalogRaceRecord } from "@/lib/catalog/types";
import { validateDiscoverCatalogRecords } from "@/lib/catalog/discover-catalog-validate";
import { EPIC_LEGACY_RECORDS } from "@/lib/catalog/epic-legacy";
import { GLOBAL_TRAIL_ULTRA_RECORDS } from "@/lib/catalog/global-trail-ultras";
import { ROAD_MAJOR_RECORDS } from "@/lib/catalog/road-majors";
import { UK_MAJOR_RECORDS } from "@/lib/catalog/uk-majors";
import { UTMB_WORLD_SERIES_RECORDS } from "@/lib/catalog/utmb-world-series";
import type { DiscoverRace } from "@/lib/discover-race-schema";

export { validateDiscoverCatalogRecords } from "@/lib/catalog/discover-catalog-validate";

/**
 * Merge order = precedence (first occurrence wins). Add new modules by appending to `CATALOG_SOURCES`.
 */
const CATALOG_SOURCES: CatalogRaceRecord[][] = [
  ROAD_MAJOR_RECORDS,
  UK_MAJOR_RECORDS,
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

function displayLocation(r: CatalogRaceRecord): string {
  if (r.location?.trim()) return r.location.trim();
  const parts = [r.city, r.region_state, r.country].filter((x) => x?.trim());
  return parts.join(", ");
}

export function recordToDiscoverRace(r: CatalogRaceRecord): DiscoverRace {
  return {
    id: r.id,
    name: r.name,
    official_name: r.official_name,
    location: displayLocation(r),
    city: r.city ?? null,
    region_state: r.region_state ?? null,
    country: r.country ?? null,
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    event_type: r.event_type,
    organizer_name: r.organizer_name ?? null,
    series_name: r.series_name ?? null,
    canonical_series_slug_hint: r.canonical_series_slug_hint ?? null,
    canonical_series_id_hint: r.canonical_series_id_hint ?? null,
    match_include_name_tokens: r.match_include_name_tokens,
    match_tier: r.match_tier,
    distance_km: r.distance_km,
    surface: r.surface,
    group: r.group,
    multi_day: r.multi_day,
    aliases: r.aliases,
    event_group: r.event_group,
    typical_months: r.typical_months,
    edition_date_anchor_ymd: r.edition_date_anchor_ymd,
    edition_date_window_days: r.edition_date_window_days,
    edition_date_quality: r.edition_date_quality,
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

const CATALOG_VALIDATION = validateDiscoverCatalogRecords(MERGED_RECORDS);
const CATALOG_ERRORS = CATALOG_VALIDATION.filter((i) => i.level === "error");
if (typeof process !== "undefined" && process.env.NODE_ENV === "development" && CATALOG_ERRORS.length > 0) {
  console.warn(
    "[discover catalog] validation errors:",
    CATALOG_ERRORS.map((e) => `${e.recordId}: ${e.message}`).join("; ")
  );
}

/** Full merged catalog (matching, trophy logic, activity dropdowns that need aliases). */
export const discoverRaces: DiscoverRace[] = MERGED_RECORDS.map(recordToDiscoverRace);

/** Find a Race & public race library — excludes `match_only` rows. */
export function getPublicCatalogRaces(): DiscoverRace[] {
  return discoverRaces.filter((r) => r.catalog_visibility !== "match_only");
}

/** Build alias map for the matcher — curated aliases only unless `match_include_name_tokens` is set. */
export function buildCatalogAliasMap(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const r of MERGED_RECORDS) {
    const list: string[] = [];
    if (r.aliases?.length) list.push(...r.aliases);
    if (r.official_name?.trim() && r.official_name.trim() !== r.name.trim()) {
      list.push(r.official_name.trim());
    }
    if (r.match_include_name_tokens) {
      const nameTokens = r.name
        .toLowerCase()
        .split(/[\s/]+/)
        .filter((w) => w.length > 2);
      for (const t of nameTokens) {
        if (!list.includes(t)) list.push(t);
      }
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
