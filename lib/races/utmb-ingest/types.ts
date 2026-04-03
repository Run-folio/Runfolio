import type { CatalogRaceRecord, EditionDateQuality } from "@/lib/catalog/types";

/**
 * External JSON rows (optional file / future scraper output) — superset of fields we persist.
 * Keep in sync with `CatalogRaceRecord` where possible.
 */
export type UtmbIngestJsonRow = {
  id: string;
  name: string;
  official_name?: string;
  location?: string;
  city?: string | null;
  region_state?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distance_km: number;
  distance_variants_km?: number[];
  elevation_m_est?: number | null;
  event_type?: string;
  surface?: CatalogRaceRecord["surface"];
  series_name?: string | null;
  event_group?: string | null;
  typical_months?: number[];
  edition_date_quality?: EditionDateQuality;
  edition_date_anchor_ymd?: string;
  aliases?: string[];
  organizer_name?: string | null;
  official_url?: string | null;
  /** Stored only in series metadata — does not add discover catalog rows. */
  discover_promote_hint?: boolean;
  tags?: string[];
  match_tier?: CatalogRaceRecord["match_tier"];
};

/** Bundled discover rows plus optional fields from JSON / scrapers. */
export type UtmbIngestRow = CatalogRaceRecord & {
  official_url?: string | null;
};

export type UtmbIngestSummary = {
  racesLoaded: number;
  seriesUpserted: number;
  seriesReused: number;
  aliasesInserted: number;
  aliasesSkippedRisky: number;
  aliasesSkippedDuplicate: number;
  editionsAttempted: number;
  importCreated: number;
  importUpdated: number;
  importLinked: number;
  importNoop: number;
  importFailed: number;
  skippedRaces: number;
  skippedEditions: number;
  validationErrors: string[];
};
