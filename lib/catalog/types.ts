import type { DiscoverGroup, DiscoverSurface } from "@/lib/discover-races-constants";

export type { DiscoverGroup, DiscoverSurface } from "@/lib/discover-races-constants";

/** Geographic bucket for dataset organization (not necessarily UI group). */
export type CatalogRegion = "europe" | "north_america" | "south_america" | "asia" | "oceania" | "africa" | "middle_east";

/** How strongly catalog date metadata should constrain discover-layer matching. */
export type EditionDateQuality = "anchor" | "month_typical" | "month_relaxed" | "sparse";

/** Curated surface / format for matching hints (orthogonal to `surface` UI bucket). */
export type DiscoverEventType = "road" | "trail" | "ultra" | "stage" | "vertical" | "mixed";

/**
 * Curated signal strength — used only for validation / QA (not required on every row).
 * `flagship`: expect full structured geo for disambiguation.
 */
export type DiscoverMatchTier = "flagship" | "major" | "regional";

/**
 * Canonical catalog record — one logical race (all editions aggregate under this id).
 * Merge into `DiscoverRace` for Find / matching / trophy cases.
 */
export type CatalogRaceRecord = {
  id: string;
  /** Primary display / match name. */
  name: string;
  /** Optional formal title when it differs from `name` (sponsor year, etc.). */
  official_name?: string;
  /** City / region, country — display line; may be derived from structured fields in `recordToDiscoverRace`. */
  location: string;
  /** Structured geography for matching (optional but recommended for flagship / majors). */
  city?: string | null;
  region_state?: string | null;
  country?: string | null;
  /** Approximate start / hub when known — enables coordinate checks when activity has GPS. */
  latitude?: number | null;
  longitude?: number | null;
  event_type?: DiscoverEventType;
  organizer_name?: string | null;
  series_name?: string | null;
  /** Optional future link to DB canonical series — never required at runtime. */
  canonical_series_slug_hint?: string | null;
  canonical_series_id_hint?: string | null;
  /**
   * When true, split `name` into short tokens and add to matcher alias map (noisy — opt-in only).
   * Default: omit / false — prefer explicit `aliases`.
   */
  match_include_name_tokens?: boolean;
  /** QA / validation tier — does not affect runtime matching directly. */
  match_tier?: DiscoverMatchTier;
  /** Primary distance for matching & filters (km). */
  distance_km: number;
  surface: DiscoverSurface;
  group: DiscoverGroup;
  multi_day?: boolean;
  /** e.g. "UTMB World Series", "Skyrunner World Series" */
  event_group?: string;
  /** 1–12 typical race month(s) */
  typical_months?: number[];
  /**
   * Recurring calendar anchor (YYYY-MM-DD). Compared in the **activity’s year** so multi-year catalogs stay valid.
   * Use with `edition_date_quality: "anchor"` and optional `edition_date_window_days`.
   */
  edition_date_anchor_ymd?: string;
  /** Half-width in days around the recurring anchor (default 21). */
  edition_date_window_days?: number;
  edition_date_quality?: EditionDateQuality;
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
