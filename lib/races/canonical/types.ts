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

/** App-owned canonical record — one row per real-world event we track. */
export type CanonicalRace = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  organizerName: string | null;
  officialUrl: string | null;
  registrationUrl: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
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
  elevationGainM: number | null;
  raceType: string | null;
  surfaceType: string | null;
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
  distanceKm: number | null;
  elevationGainM: number | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
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
