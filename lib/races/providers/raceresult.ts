/**
 * Race Result–style metadata (logos, branding).
 *
 * TODO (needs vendor API or data partner agreement):
 * - Search + by-id endpoints for logo/banner URLs and official links.
 * - Prefer merging these rows in `enrichment.ts` over bare catalog entries.
 *
 * Env placeholders:
 *   RACES_RACERESULT_API_KEY=
 *   RACES_RACERESULT_BASE_URL=
 */
import { buildInternalRaceId } from "@/lib/races/id";
import { slugifyRaceName } from "@/lib/races/normalize/slug";
import type { RaceDataProvider, ProviderCallResult } from "@/lib/races/providers/base";
import { logStubProviderCall } from "@/lib/races/providers/stub-fetch";
import type { NormalizedRace, RaceSearchFilters } from "@/lib/races/types/normalized";

export type RaceResultEventRecord = {
  id?: string;
  name?: string;
  logoUrl?: string;
  bannerUrl?: string;
  website?: string;
  city?: string;
  country?: string;
  raceDate?: string;
};

function envConfigured(): boolean {
  return Boolean(process.env.RACES_RACERESULT_API_KEY?.trim());
}

function mapRecord(raw: RaceResultEventRecord): NormalizedRace {
  const sid = String(raw.id ?? "unknown");
  return {
    id: buildInternalRaceId("raceresult", sid),
    source: "raceresult",
    sourceRaceId: sid,
    name: raw.name ?? "Unknown event",
    slug: slugifyRaceName(raw.name ?? "event"),
    description: null,
    organizerName: null,
    officialUrl: raw.website ?? null,
    registrationUrl: null,
    logoUrl: raw.logoUrl ?? null,
    heroImageUrl: raw.bannerUrl ?? null,
    country: raw.country ?? null,
    region: null,
    city: raw.city ?? null,
    venue: null,
    latitude: null,
    longitude: null,
    startDate: raw.raceDate?.slice(0, 10) ?? null,
    endDate: null,
    timezone: null,
    distanceKm: null,
    elevationGainM: null,
    raceType: null,
    surfaceType: null,
    categoryTags: ["enrichment"],
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

export function createRaceResultProvider(): RaceDataProvider {
  return {
    id: "raceresult",
    label: "Race Result",
    get isConfigured() {
      return envConfigured();
    },

    async searchRaces(params: RaceSearchFilters): Promise<ProviderCallResult<NormalizedRace[]>> {
      logStubProviderCall("raceresult", "search", { query: params.query ?? "" });
      if (!envConfigured()) return { ok: true, data: [] };
      return { ok: true, data: [] };
    },

    async getRaceBySourceId(sourceRaceId: string): Promise<ProviderCallResult<NormalizedRace | null>> {
      logStubProviderCall("raceresult", "getById", { id: sourceRaceId });
      if (!envConfigured()) return { ok: true, data: null };
      return { ok: true, data: null };
    },

    mapToNormalizedRace(raw: unknown): NormalizedRace {
      return mapRecord(raw as RaceResultEventRecord);
    }
  };
}
