import { slugifyRaceName } from "@/lib/races/normalize/slug";
import { buildInternalRaceId } from "@/lib/races/id";
import type { NormalizedRace } from "@/lib/races/types/normalized";
import { editionStartDateYmd } from "@/lib/races/utmb-ingest/edition-anchor";
import { inferUtmbIndexCategory } from "@/lib/races/utmb-ingest/utmb-category";
import type { UtmbIngestRow } from "@/lib/races/utmb-ingest/types";

function eventTypeLabel(row: UtmbIngestRow): string | null {
  return row.event_type ?? null;
}

function ultraFromDistance(km: number): boolean {
  return km >= 50;
}

/**
 * One normalized edition row per catalog race × year (stable `source_race_id`: `${id}:${year}`).
 */
export function utmbRowToEditionNormalized(
  row: UtmbIngestRow,
  year: number,
  seriesId: string
): NormalizedRace | null {
  const startDate = editionStartDateYmd(year, row);
  if (!startDate) return null;

  const utmbCat = inferUtmbIndexCategory(row.distance_km);
  const quality = row.edition_date_quality ?? "month_relaxed";
  const categoryTags = [
    "utmb_ws",
    "utmb_edition_anchor",
    `edition_date_quality:${quality}`,
    ...(row.tags ?? []).slice(0, 20)
  ];

  const sourceRaceId = `${row.id}:${year}`;
  const trail = row.surface === "trail";
  const road = row.surface === "road";

  return {
    id: buildInternalRaceId("utmb_ws", sourceRaceId),
    source: "utmb_ws",
    sourceRaceId,
    name: row.name,
    slug: slugifyRaceName(`${row.name} ${year}`),
    description: row.location ? `${row.distance_km} km — ${row.location}`.slice(0, 2000) : null,
    organizerName: row.series_name ?? row.event_group ?? null,
    officialUrl: row.official_url?.trim() || null,
    registrationUrl: null,
    logoUrl: null,
    heroImageUrl: null,
    country: row.country ?? null,
    region: row.region_state ?? null,
    city: row.city ?? null,
    venue: null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    startDate,
    endDate: null,
    timezone: null,
    distanceKm: row.distance_km,
    elevationGainM: row.elevation_m_est ?? null,
    raceType: eventTypeLabel(row),
    surfaceType: row.surface,
    categoryTags,
    canonicalSeriesId: seriesId,
    difficultyScore: null,
    utmbIndexEligible: row.group === "utmb" || (row.tags?.includes("utmb_finals") ?? false),
    utmbCategory: utmbCat,
    isTrail: trail ? true : road ? false : null,
    isRoad: road ? true : trail ? false : null,
    isUltra: ultraFromDistance(row.distance_km),
    createdAt: null,
    updatedAt: null,
    rawPayload: {
      utmb_catalog_id: row.id,
      edition_year: year,
      edition_start_ymd: startDate,
      edition_date_quality: quality,
      utmb_index_category: utmbCat,
      distance_variants_km: row.distance_variants_km ?? null
    } as Record<string, unknown>
  };
}
