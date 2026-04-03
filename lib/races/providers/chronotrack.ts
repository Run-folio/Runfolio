/**
 * ChronoTrack API — timing / registration ecosystem.
 *
 * TODO (requires ChronoTrack partner documentation):
 * - Event search + detail endpoints, auth headers, and error payloads.
 * - Map timing/event types into `NormalizedRace` (distance may live on sub-events).
 *
 * Env placeholders:
 *   RACES_CHRONOTRACK_API_KEY=
 *   RACES_CHRONOTRACK_BASE_URL=
 */
import { buildInternalRaceId } from "@/lib/races/id";
import { slugifyRaceName } from "@/lib/races/normalize/slug";
import type { RaceDataProvider, ProviderCallResult } from "@/lib/races/providers/base";
import { logStubProviderCall } from "@/lib/races/providers/stub-fetch";
import type { NormalizedRace, RaceSearchFilters } from "@/lib/races/types/normalized";

export type ChronoTrackEventRecord = {
  eventId?: string;
  eventName?: string;
  eventDate?: string;
  logoUrl?: string;
};

function envConfigured(): boolean {
  return Boolean(process.env.RACES_CHRONOTRACK_API_KEY?.trim());
}

function mapRecord(raw: ChronoTrackEventRecord): NormalizedRace {
  const sid = String(raw.eventId ?? "unknown");
  return {
    id: buildInternalRaceId("chronotrack", sid),
    source: "chronotrack",
    sourceRaceId: sid,
    name: raw.eventName ?? "Unknown event",
    slug: slugifyRaceName(raw.eventName ?? "event"),
    description: null,
    organizerName: null,
    officialUrl: null,
    registrationUrl: null,
    logoUrl: raw.logoUrl ?? null,
    heroImageUrl: null,
    country: null,
    region: null,
    city: null,
    venue: null,
    latitude: null,
    longitude: null,
    startDate: raw.eventDate?.slice(0, 10) ?? null,
    endDate: null,
    timezone: null,
    distanceKm: null,
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

export function createChronoTrackProvider(): RaceDataProvider {
  return {
    id: "chronotrack",
    label: "ChronoTrack",
    get isConfigured() {
      return envConfigured();
    },

    async searchRaces(params: RaceSearchFilters): Promise<ProviderCallResult<NormalizedRace[]>> {
      logStubProviderCall("chronotrack", "search", { query: params.query ?? "" });
      if (!envConfigured()) return { ok: true, data: [] };
      return { ok: true, data: [] };
    },

    async getRaceBySourceId(sourceRaceId: string): Promise<ProviderCallResult<NormalizedRace | null>> {
      logStubProviderCall("chronotrack", "getById", { id: sourceRaceId });
      if (!envConfigured()) return { ok: true, data: null };
      return { ok: true, data: null };
    },

    mapToNormalizedRace(raw: unknown): NormalizedRace {
      return mapRecord(raw as ChronoTrackEventRecord);
    }
  };
}
