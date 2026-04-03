import type { DiscoverGroup, DiscoverSurface } from "@/lib/discover-races-constants";

export type { DiscoverGroup, DiscoverSurface } from "@/lib/discover-races-constants";

/** Geographic bucket for dataset organization (not necessarily UI group). */
export type CatalogRegion = "europe" | "north_america" | "south_america" | "asia" | "oceania" | "africa" | "middle_east";

/**
 * Canonical catalog record — one logical race (all editions aggregate under this id).
 * Merge into `DiscoverRace` for Find / matching / trophy cases.
 */
export type CatalogRaceRecord = {
  id: string;
  name: string;
  /** City / region, country */
  location: string;
  /** Primary distance for matching & filters (km). */
  distance_km: number;
  surface: DiscoverSurface;
  group: DiscoverGroup;
  multi_day?: boolean;
  /** e.g. "UTMB World Series", "Skyrunner World Series" */
  event_group?: string;
  /** 1–12 typical race month(s) */
  typical_months?: number[];
  /** Optional extra distances offered (km) — matching tolerance uses min/max. */
  distance_variants_km?: number[];
  /** Rough course vert for elevation similarity (m). */
  elevation_m_est?: number | null;
  tags?: string[];
  /** Lowercase phrases for title matching (in addition to name tokens). */
  aliases?: string[];
  /** Added to composite match score, capped in matcher (UTMB / majors). */
  match_boost?: number;
  region?: CatalogRegion;
  /** `match_only` = usable for Strava match UI but hidden from Find a Race browse. */
  catalog_visibility?: "public" | "match_only";
  source?: "road_major" | "utmb_ws" | "global_trail" | "legacy_epic" | "system";
};
