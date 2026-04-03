/**
 * RunSignup — live adapter for https://api.runsignup.com/rest/races
 * Docs: https://runsignup.com/API/races/GET · https://runsignup.com/API/race/:race_id/GET
 *
 * Env (pick one auth style):
 *   Classic: RACES_RUNSIGNUP_API_KEY + RACES_RUNSIGNUP_API_SECRET
 *   RSU v2:  RACES_RUNSIGNUP_RSU_API_KEY + RACES_RUNSIGNUP_RSU_SECRET (sent as X-RSU-API-SECRET)
 * Optional: RACES_RUNSIGNUP_BASE_URL (default https://api.runsignup.com/rest)
 */
import { buildInternalRaceId } from "@/lib/races/id";
import { slugifyRaceName } from "@/lib/races/normalize/slug";
import type { RaceDataProvider, ProviderCallResult } from "@/lib/races/providers/base";
import {
  getRunSignupAuthMode,
  parseRunSignupRaceRecord,
  runSignupRestGet,
  unwrapRunSignupRaceList,
  unwrapRunSignupSingleRace
} from "@/lib/races/providers/runsignup-api";
import type { NormalizedRace, RaceSearchFilters } from "@/lib/races/types/normalized";

type RunSignupMapped = ReturnType<typeof parseRunSignupRaceRecord>;

function mapRecord(raw: RunSignupMapped, rawPayload?: Record<string, unknown>): NormalizedRace {
  const sid = raw.race_id || "unknown";
  const dist = raw.distance_km;
  const ultra = dist != null && dist >= 50;
  return {
    id: buildInternalRaceId("runsignup", sid),
    source: "runsignup",
    sourceRaceId: sid,
    name: raw.name,
    slug: slugifyRaceName(raw.name),
    description: null,
    organizerName: null,
    officialUrl: raw.url,
    registrationUrl: raw.url,
    logoUrl: null,
    heroImageUrl: null,
    country: raw.address.country ?? null,
    region: raw.address.state ?? null,
    city: raw.address.city ?? null,
    venue: null,
    latitude: null,
    longitude: null,
    startDate: raw.event_start_time ? raw.event_start_time.slice(0, 10) : null,
    endDate: null,
    timezone: null,
    distanceKm: dist,
    elevationGainM: null,
    raceType: null,
    surfaceType: null,
    categoryTags: [],
    difficultyScore: null,
    utmbIndexEligible: null,
    utmbCategory: null,
    isTrail: null,
    isRoad: null,
    isUltra: ultra,
    createdAt: null,
    updatedAt: null,
    rawPayload: rawPayload ?? ({ ...raw } as Record<string, unknown>)
  };
}

function applyClientFilters(rows: NormalizedRace[], params: RaceSearchFilters): NormalizedRace[] {
  return rows.filter((r) => {
    if (params.trailOnly && r.isTrail === false) return false;
    if (params.ultraOnly && !r.isUltra) return false;
    if (params.elevationMinM != null && (r.elevationGainM ?? 0) < params.elevationMinM) return false;
    if (params.elevationMaxM != null && r.elevationGainM != null && r.elevationGainM > params.elevationMaxM)
      return false;
    return true;
  });
}

export function createRunSignupProvider(): RaceDataProvider {
  return {
    id: "runsignup",
    label: "RunSignup",
    get isConfigured() {
      return getRunSignupAuthMode() !== "none";
    },

    async searchRaces(params: RaceSearchFilters): Promise<ProviderCallResult<NormalizedRace[]>> {
      if (getRunSignupAuthMode() === "none") {
        return { ok: true, data: [] };
      }

      const limit = Math.min(params.limitPerProvider ?? 40, 100);
      const today = new Date().toISOString().slice(0, 10);
      const q: Record<string, string | undefined> = {
        name: params.query?.trim() || undefined,
        city: params.city,
        country: params.country,
        start_date: params.dateFrom ?? today,
        end_date: params.dateTo,
        results_per_page: String(limit),
        page: "1",
        sort: "date ASC",
        distance_units: "K"
      };
      if (params.distanceMinKm != null) q.min_distance = String(params.distanceMinKm);
      if (params.distanceMaxKm != null) q.max_distance = String(params.distanceMaxKm);

      const res = await runSignupRestGet("/races", q);
      if (!res.ok) {
        return { ok: false, error: res.error };
      }

      const list = unwrapRunSignupRaceList(res.data);
      const mapped = list
        .map((row) => {
          const parsed = parseRunSignupRaceRecord(row);
          return parsed.race_id ? mapRecord(parsed, row) : null;
        })
        .filter((x): x is NormalizedRace => x != null);

      return { ok: true, data: applyClientFilters(mapped, params) };
    },

    async getRaceBySourceId(sourceRaceId: string): Promise<ProviderCallResult<NormalizedRace | null>> {
      if (getRunSignupAuthMode() === "none") {
        return { ok: true, data: null };
      }
      const res = await runSignupRestGet(`/race/${encodeURIComponent(sourceRaceId)}`, {
        future_events_only: "T"
      });
      if (!res.ok) {
        return { ok: false, error: res.error };
      }
      const row = unwrapRunSignupSingleRace(res.data);
      if (!row) return { ok: true, data: null };
      const parsed = parseRunSignupRaceRecord(row);
      if (!parsed.race_id) return { ok: true, data: null };
      return { ok: true, data: mapRecord(parsed, row) };
    },

    mapToNormalizedRace(raw: unknown): NormalizedRace {
      if (!raw || typeof raw !== "object") {
        throw new Error("RunSignup mapToNormalizedRace: expected object");
      }
      const row = raw as Record<string, unknown>;
      const parsed = parseRunSignupRaceRecord(row);
      return mapRecord(parsed, row);
    }
  };
}
