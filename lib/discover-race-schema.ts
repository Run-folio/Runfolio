import type { CatalogRegion } from "@/lib/catalog/types";
import type { DiscoverGroup, DiscoverSurface } from "@/lib/discover-races-constants";

/** Runtime catalog row — merged from modular datasets in `lib/catalog/`. */
export type DiscoverRace = {
  id: string;
  name: string;
  location: string;
  distance_km: number;
  surface: DiscoverSurface;
  group: DiscoverGroup;
  multi_day?: boolean;
  aliases?: string[];
  event_group?: string;
  typical_months?: number[];
  elevation_m_est?: number | null;
  tags?: string[];
  distance_variants_km?: number[];
  match_boost?: number;
  region?: CatalogRegion;
  catalog_visibility?: "public" | "match_only";
  source?: string;
};
