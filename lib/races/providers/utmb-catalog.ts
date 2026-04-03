/**
 * Internal UTMB / trail catalog adapter — maps existing `discoverRaces` into `NormalizedRace`.
 * Data is bundled with the app (`lib/catalog/`). No external HTTP.
 *
 * TODO (optional future adapter): if UTMB or a partner exposes a public events API,
 * add a separate provider (e.g. `utmb_api`) — do not overload this file.
 */
import type { DiscoverRace } from "@/lib/discover-race-schema";
import { discoverRaces } from "@/lib/discover-races";
import { buildInternalRaceId } from "@/lib/races/id";
import { slugifyRaceName } from "@/lib/races/normalize/slug";
import type { RaceDataProvider, ProviderCallResult } from "@/lib/races/providers/base";
import type { NormalizedRace, RaceSearchFilters } from "@/lib/races/types/normalized";

export function discoverRaceToNormalized(race: DiscoverRace): NormalizedRace {
  const variants = race.distance_variants_km ?? [];
  const maxDist = Math.max(race.distance_km, ...variants.filter((d) => d > 0));
  const ultra = maxDist >= 50;
  const trail = race.surface === "trail";
  const road = race.surface === "road";

  const loc = race.location ?? "";
  const parts = loc.split(",").map((s) => s.trim());
  const city = parts[0] || null;
  const country = parts.length > 1 ? parts[parts.length - 1] : null;

  return {
    id: buildInternalRaceId("utmb_catalog", race.id),
    source: "utmb_catalog",
    sourceRaceId: race.id,
    name: race.name,
    slug: slugifyRaceName(race.name),
    description: null,
    organizerName: race.event_group ?? null,
    officialUrl: null,
    registrationUrl: null,
    logoUrl: null,
    heroImageUrl: null,
    country,
    region: race.region ?? null,
    city,
    venue: null,
    latitude: null,
    longitude: null,
    startDate: null,
    endDate: null,
    timezone: null,
    distanceKm: race.distance_km,
    elevationGainM: race.elevation_m_est ?? null,
    raceType: race.group,
    surfaceType: race.surface,
    categoryTags: [...(race.tags ?? []), ...(race.aliases ?? [])].slice(0, 24),
    difficultyScore: null,
    utmbIndexEligible: race.group === "utmb" || (race.tags?.includes("utmb_finals") ?? false),
    utmbCategory: race.group === "utmb" ? race.name : null,
    isTrail: trail ? true : road ? false : null,
    isRoad: road ? true : trail ? false : null,
    isUltra: ultra,
    createdAt: null,
    updatedAt: null,
    rawPayload: { ...race } as unknown as Record<string, unknown>
  };
}

function matchesFilters(race: NormalizedRace, f: RaceSearchFilters): boolean {
  if (f.trailOnly && !race.isTrail) return false;
  if (f.ultraOnly && !race.isUltra) return false;
  if (f.country && race.country) {
    if (!race.country.toLowerCase().includes(f.country.toLowerCase())) return false;
  }
  if (f.city && race.city) {
    if (!race.city.toLowerCase().includes(f.city.toLowerCase())) return false;
  }
  if (f.distanceMinKm != null && race.distanceKm != null && race.distanceKm < f.distanceMinKm) return false;
  if (f.distanceMaxKm != null && race.distanceKm != null && race.distanceKm > f.distanceMaxKm) return false;
  if (f.elevationMinM != null && race.elevationGainM != null && race.elevationGainM < f.elevationMinM) return false;
  if (f.elevationMaxM != null && race.elevationGainM != null && race.elevationGainM > f.elevationMaxM) return false;
  if (f.query?.trim()) {
    const q = f.query.trim().toLowerCase();
    const blob = `${race.name} ${race.categoryTags.join(" ")} ${race.city ?? ""} ${race.country ?? ""}`.toLowerCase();
    if (!blob.includes(q)) return false;
  }
  // Catalog rows rarely have startDate; date range filter skipped unless we add typical_months later
  void f.dateFrom;
  void f.dateTo;
  return true;
}

export function createUtmbCatalogProvider(): RaceDataProvider {
  return {
    id: "utmb_catalog",
    label: "Runfolio catalog (UTMB & trail)",
    isConfigured: true,

    async searchRaces(params: RaceSearchFilters): Promise<ProviderCallResult<NormalizedRace[]>> {
      const limit = params.limitPerProvider ?? 80;
      const normalized = discoverRaces.map(discoverRaceToNormalized).filter((r) => matchesFilters(r, params));
      return { ok: true, data: normalized.slice(0, limit) };
    },

    async getRaceBySourceId(sourceRaceId: string): Promise<ProviderCallResult<NormalizedRace | null>> {
      const row = discoverRaces.find((r) => r.id === sourceRaceId);
      if (!row) return { ok: true, data: null };
      return { ok: true, data: discoverRaceToNormalized(row) };
    },

    mapToNormalizedRace(raw: unknown): NormalizedRace {
      return discoverRaceToNormalized(raw as DiscoverRace);
    }
  };
}
