/**
 * ACTIVE / Active.com–style events.
 *
 * TODO (needs partner / Active Network API contract):
 * - Confirm base URL, auth scheme (OAuth2 vs API key), rate limits, and pagination.
 * - Add typed response models (Zod or explicit interfaces) per endpoint.
 * - Map `searchRaces` query params to provider fields; handle partial pages.
 *
 * Env placeholders (rename to match vendor docs when integrating):
 *   RACES_ACTIVE_API_KEY=
 *   RACES_ACTIVE_BASE_URL=
 */
import { buildInternalRaceId } from "@/lib/races/id";
import { slugifyRaceName } from "@/lib/races/normalize/slug";
import type { RaceDataProvider, ProviderCallResult } from "@/lib/races/providers/base";
import { logStubProviderCall } from "@/lib/races/providers/stub-fetch";
import type { NormalizedRace, RaceSearchFilters } from "@/lib/races/types/normalized";

/** Placeholder JSON shape — replace when API contract is known */
export type ActiveEventRecord = {
  id?: string;
  name?: string;
  startDate?: string;
  location?: { city?: string; country?: string };
  distanceKm?: number;
  url?: string;
};

function envConfigured(): boolean {
  return Boolean(process.env.RACES_ACTIVE_API_KEY?.trim() && process.env.RACES_ACTIVE_BASE_URL?.trim());
}

function emptyNormalizedFromStub(raw: ActiveEventRecord): NormalizedRace {
  const sid = String(raw.id ?? "unknown");
  return {
    id: buildInternalRaceId("active", sid),
    source: "active",
    sourceRaceId: sid,
    name: raw.name ?? "Unknown event",
    slug: slugifyRaceName(raw.name ?? "event"),
    description: null,
    organizerName: null,
    officialUrl: raw.url ?? null,
    registrationUrl: null,
    logoUrl: null,
    heroImageUrl: null,
    country: raw.location?.country ?? null,
    region: null,
    city: raw.location?.city ?? null,
    venue: null,
    latitude: null,
    longitude: null,
    startDate: raw.startDate ?? null,
    endDate: null,
    timezone: null,
    distanceKm: raw.distanceKm ?? null,
    elevationGainM: null,
    raceType: null,
    surfaceType: null,
    categoryTags: [],
    difficultyScore: null,
    utmbIndexEligible: null,
    utmbCategory: null,
    isTrail: null,
    isRoad: null,
    isUltra: null,
    createdAt: null,
    updatedAt: null,
    rawPayload: raw as Record<string, unknown>
  };
}

export function createActiveProvider(): RaceDataProvider {
  return {
    id: "active",
    label: "ACTIVE",
    get isConfigured() {
      return envConfigured();
    },

    async searchRaces(params: RaceSearchFilters): Promise<ProviderCallResult<NormalizedRace[]>> {
      logStubProviderCall("active", "search", { query: params.query ?? "" });
      if (!envConfigured()) {
        return { ok: true, data: [] };
      }
      // TODO: GET/POST Active API, parse typed response, map each row.
      return { ok: true, data: [] };
    },

    async getRaceBySourceId(sourceRaceId: string): Promise<ProviderCallResult<NormalizedRace | null>> {
      logStubProviderCall("active", "getById", { id: sourceRaceId });
      if (!envConfigured()) {
        return { ok: true, data: null };
      }
      return { ok: true, data: null };
    },

    mapToNormalizedRace(raw: unknown): NormalizedRace {
      const r = raw as ActiveEventRecord;
      return emptyNormalizedFromStub(r);
    }
  };
}
