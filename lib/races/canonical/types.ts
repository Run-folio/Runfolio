/**
 * Canonical race knowledge layer (app-owned IDs).
 * Distinct from portfolio `Race` in `@/types` (user-owned rows).
 */
import type { RaceIngestSource } from "@/lib/races/types/normalized";

export type CanonicalRaceStatus =
  | "draft"
  | "active"
  | "hidden"
  | "needs_review"
  | "duplicate_candidate";

/** Background web enrichment lifecycle (see `canonical_enrichment_jobs`). */
export type CanonicalEnrichmentStatus =
  | "never"
  | "queued"
  | "running"
  | "complete"
  | "failed"
  | "skipped";

/**
 * App-owned canonical record: one row ≈ one **edition** when `startDate` is set.
 * `seriesId` links recurring editions to `canonical_race_series` when backfilled.
 */
export type CanonicalRace = {
  id: string;
  slug: string;
  /** Parent recurring series when backfilled (`canonical_race_series.id`). */
  seriesId: string | null;
  name: string;
  description: string | null;
  /** Longer editorial or extracted body copy (cards may use `description`). */
  longDescription: string | null;
  organizerName: string | null;
  officialUrl: string | null;
  registrationUrl: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  /** When no hero/logo from sources — often app-generated branded card URL. */
  fallbackImageUrl: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  venue: string | null;
  latitude: number | null;
  longitude: number | null;
  startDate: string | null;
  endDate: string | null;
  timezone: string | null;
  distanceKm: number | null;
  /** Multiple distances when parsed from official pages (e.g. half + full). */
  distanceOptionsKm: number[];
  elevationGainM: number | null;
  raceType: string | null;
  surfaceType: string | null;
  /**
   * Tags / facets. Conventions (string prefixes): `alias:…` alternate names; future `series:…`
   * to group editions when multi-row-per-event is modeled more explicitly.
   */
  categoryTags: string[];
  difficultyScore: number | null;
  utmbIndexEligible: boolean | null;
  utmbCategory: string | null;
  isTrail: boolean | null;
  isRoad: boolean | null;
  isUltra: boolean | null;
  qualityScore: number;
  completenessScore: number;
  qualityFlags: Record<string, boolean>;
  status: CanonicalRaceStatus;
  enrichmentStatus: CanonicalEnrichmentStatus;
  lastEnrichedAt: string | null;
  /** Provenance: image scores, flags like usedGeneratedSummary, fetch URL, errors. */
  enrichmentMeta: Record<string, unknown>;
  /** Field names locked against automated overwrites (future manual curation). */
  curationLocked: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
};

export type CanonicalRaceSource = {
  id: string;
  raceId: string;
  source: RaceIngestSource;
  sourceRaceId: string;
  sourceUrl: string | null;
  lastFetchedAt: string | null;
  lastSyncedAt: string | null;
  rawPayload: Record<string, unknown> | null;
  rawHash: string | null;
  mappedFields: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

/** Row returned to Find / cards — stable internal id, no provider ids. */
export type SearchableRaceRow = {
  id: string;
  slug: string;
  name: string;
  locationLabel: string;
  startDate: string | null;
  /** Short label for cards (ISO date or “Undated / series”). */
  dateSummary: string;
  distanceKm: number | null;
  elevationGainM: number | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  fallbackImageUrl: string | null;
  raceType: string | null;
  surfaceType: string | null;
  categoryTags: string[];
  completenessScore: number;
  qualityScore: number;
};

export type CanonicalSearchFilters = {
  query?: string;
  country?: string;
  city?: string;
  dateFrom?: string;
  dateTo?: string;
  trailOnly?: boolean;
  ultraOnly?: boolean;
  distanceMinKm?: number;
  distanceMaxKm?: number;
  limit?: number;
};
