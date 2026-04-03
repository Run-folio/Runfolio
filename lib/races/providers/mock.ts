/**
 * Deterministic mock races for local / CI testing of the ingest pipeline.
 * Enable with `RACES_MOCK_PROVIDER=1` (server only). Not registered in production by default.
 */
import { buildInternalRaceId } from "@/lib/races/id";
import { slugifyRaceName } from "@/lib/races/normalize/slug";
import type { RaceDataProvider, ProviderCallResult } from "@/lib/races/providers/base";
import type { NormalizedRace, RaceSearchFilters } from "@/lib/races/types/normalized";

function mockRow(
  sourceRaceId: string,
  name: string,
  extra: Partial<NormalizedRace>
): NormalizedRace {
  return {
    id: buildInternalRaceId("mock", sourceRaceId),
    source: "mock",
    sourceRaceId,
    name,
    slug: slugifyRaceName(name),
    description: "Mock provider row for development.",
    organizerName: "Mock Endurance Series",
    officialUrl: "https://example.com",
    registrationUrl: null,
    logoUrl: null,
    heroImageUrl: null,
    country: "USA",
    region: "CA",
    city: "San Francisco",
    venue: null,
    latitude: null,
    longitude: null,
    startDate: "2026-04-15",
    endDate: null,
    timezone: null,
    distanceKm: 50,
    elevationGainM: 1200,
    raceType: "trail_ultra",
    surfaceType: "trail",
    categoryTags: ["mock"],
    difficultyScore: null,
    utmbIndexEligible: null,
    utmbCategory: null,
    isTrail: true,
    isRoad: false,
    isUltra: true,
    createdAt: null,
    updatedAt: null,
    rawPayload: { mock: true, sourceRaceId },
    ...extra
  };
}

const MOCK_CATALOG: NormalizedRace[] = [
  mockRow("mock-1", "Bay Ridge Trail 50K", { distanceKm: 50 }),
  mockRow("mock-2", "Harbor Loop Marathon", {
    distanceKm: 42.2,
    isUltra: false,
    isTrail: false,
    isRoad: true,
    surfaceType: "road",
    raceType: "marathon"
  }),
  mockRow("mock-3", "Redwood Skyline Ultra", { distanceKm: 80, elevationGainM: 2800 })
];

function matchesMockFilters(r: NormalizedRace, params: RaceSearchFilters): boolean {
  const q = params.query?.trim().toLowerCase();
  if (q) {
    const blob = `${r.name} ${r.city ?? ""} ${r.country ?? ""}`.toLowerCase();
    if (!blob.includes(q)) return false;
  }
  if (params.trailOnly && !r.isTrail) return false;
  if (params.ultraOnly && !r.isUltra) return false;
  if (params.distanceMinKm != null && r.distanceKm != null && r.distanceKm < params.distanceMinKm) return false;
  if (params.distanceMaxKm != null && r.distanceKm != null && r.distanceKm > params.distanceMaxKm) return false;
  if (params.country && r.country && !r.country.toLowerCase().includes(params.country.toLowerCase())) return false;
  if (params.city && r.city && !r.city.toLowerCase().includes(params.city.toLowerCase())) return false;
  return true;
}

export function createMockRaceProvider(): RaceDataProvider {
  return {
    id: "mock",
    label: "Mock (dev)",
    isConfigured: true,

    async searchRaces(params: RaceSearchFilters): Promise<ProviderCallResult<NormalizedRace[]>> {
      const limit = params.limitPerProvider ?? 10;
      const out = MOCK_CATALOG.filter((r) => matchesMockFilters(r, params)).slice(0, limit);
      return { ok: true, data: out };
    },

    async getRaceBySourceId(sourceRaceId: string): Promise<ProviderCallResult<NormalizedRace | null>> {
      const hit = MOCK_CATALOG.find((r) => r.sourceRaceId === sourceRaceId);
      return { ok: true, data: hit ?? null };
    },

    mapToNormalizedRace(raw: unknown): NormalizedRace {
      if (raw && typeof raw === "object" && "sourceRaceId" in raw) {
        return raw as NormalizedRace;
      }
      return MOCK_CATALOG[0]!;
    }
  };
}
