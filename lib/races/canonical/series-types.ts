/**
 * DB-backed recurring race series + aliases (`canonical_race_series`, `canonical_race_alias`).
 * Editions remain `canonical_races` rows linked via optional `series_id`.
 */

export type CanonicalRaceAliasKind =
  | "official"
  | "short"
  | "abbrev"
  | "sponsor"
  | "alt_spelling"
  | "variant";

export type CanonicalRaceSeries = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  organizerName: string | null;
  officialUrl: string | null;
  defaultSurfaceType: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CanonicalRaceAliasRow = {
  id: string;
  seriesId: string | null;
  raceId: string | null;
  aliasText: string;
  aliasNormalized: string;
  kind: CanonicalRaceAliasKind;
};
