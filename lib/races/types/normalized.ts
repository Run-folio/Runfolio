/**
 * Canonical shape for races aggregated from external providers + internal catalog.
 * All providers map into this model; unknown fields are null.
 */

export type RaceIngestSource =
  | "active"
  | "runsignup"
  | "chronotrack"
  | "utmb_catalog"
  /** Curated UTMB World Series / Index style rows ingested into canonical (series + dated editions). */
  | "utmb_ws"
  | "raceresult"
  | "mock"
  | "manual";

/** ISO 8601 date (YYYY-MM-DD) or full datetime string from provider */
export type IsoDateString = string;

export type NormalizedRace = {
  /** Stable id: `${source}:${sourceRaceId}` (see `buildInternalRaceId`) */
  id: string;
  source: RaceIngestSource;
  /** Provider-native identifier */
  sourceRaceId: string;
  name: string;
  slug: string;
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
  startDate: IsoDateString | null;
  endDate: IsoDateString | null;
  timezone: string | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  raceType: string | null;
  surfaceType: string | null;
  categoryTags: string[];
  /** When ingest resolves a recurring series (`canonical_race_series.id`), attach for edition rows. */
  canonicalSeriesId?: string | null;
  difficultyScore: number | null;
  utmbIndexEligible: boolean | null;
  utmbCategory: string | null;
  isTrail: boolean | null;
  isRoad: boolean | null;
  isUltra: boolean | null;
  createdAt: IsoDateString | null;
  updatedAt: IsoDateString | null;
  /** Original provider JSON for debugging / re-processing */
  rawPayload: Record<string, unknown> | null;
};

export type RaceSearchFilters = {
  query?: string;
  country?: string;
  city?: string;
  dateFrom?: IsoDateString;
  dateTo?: IsoDateString;
  trailOnly?: boolean;
  ultraOnly?: boolean;
  distanceMinKm?: number;
  distanceMaxKm?: number;
  elevationMinM?: number;
  elevationMaxM?: number;
  /** Max per provider before merge */
  limitPerProvider?: number;
};

export type UnifiedSearchRequest = RaceSearchFilters & {
  /** If omitted, all registered providers run */
  providers?: RaceIngestSource[];
};

export type ProviderSearchError = {
  provider: RaceIngestSource;
  message: string;
};

export type UnifiedSearchResponse = {
  ok: true;
  races: NormalizedRace[];
  providerErrors: ProviderSearchError[];
};
