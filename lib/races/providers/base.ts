import type { NormalizedRace, RaceIngestSource, RaceSearchFilters } from "@/lib/races/types/normalized";

export type ProviderCallResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface RaceDataProvider {
  readonly id: RaceIngestSource;
  readonly label: string;
  /** True when env / keys are present enough to attempt live HTTP (may still return empty). */
  readonly isConfigured: boolean;

  searchRaces(params: RaceSearchFilters): Promise<ProviderCallResult<NormalizedRace[]>>;

  getRaceBySourceId(sourceRaceId: string): Promise<ProviderCallResult<NormalizedRace | null>>;

  /** Map a single provider payload; throws if payload is structurally invalid for this provider. */
  mapToNormalizedRace(raw: unknown): NormalizedRace;
}
