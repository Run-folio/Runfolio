import type {
  CatalogRegion,
  DiscoverEventType,
  DiscoverMatchTier,
  EditionDateQuality
} from "@/lib/catalog/types";
import type { DiscoverGroup, DiscoverSurface } from "@/lib/discover-races-constants";

export type {
  CatalogRegion,
  DiscoverEventType,
  DiscoverMatchTier,
  EditionDateQuality
} from "@/lib/catalog/types";

/**
 * Runtime discover row — curated major-race hints for Find + known-race matching.
 * One logical event (not a full edition table); optional fields stay optional.
 */
export type DiscoverRace = {
  id: string;
  name: string;
  official_name?: string;
  /** Display location line */
  location: string;
  city?: string | null;
  region_state?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  event_type?: DiscoverEventType;
  organizer_name?: string | null;
  series_name?: string | null;
  canonical_series_slug_hint?: string | null;
  canonical_series_id_hint?: string | null;
  match_include_name_tokens?: boolean;
  match_tier?: DiscoverMatchTier;
  distance_km: number;
  surface: DiscoverSurface;
  group: DiscoverGroup;
  multi_day?: boolean;
  aliases?: string[];
  event_group?: string;
  typical_months?: number[];
  edition_date_anchor_ymd?: string;
  edition_date_window_days?: number;
  edition_date_quality?: EditionDateQuality;
  elevation_m_est?: number | null;
  tags?: string[];
  distance_variants_km?: number[];
  match_boost?: number;
  region?: CatalogRegion;
  catalog_visibility?: "public" | "match_only";
  source?: string;
};
