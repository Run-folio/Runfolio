import { getDiscoverPrestigeMeta, WORLD_MAJOR_MARATHON_DISCOVER_IDS } from "@/lib/discover-race-prestige";
import { roughCountryFromLocation } from "@/lib/running-profile/stats";
import type { Race } from "@/types";
import { parseRaceClockToSeconds, SUB_THREE_MARATHON_SECONDS } from "@/lib/race-identity/time-parse";
import type {
  RunnerAchievement,
  RunnerIdentityPresentation,
  RunnerRaceIdentity
} from "@/lib/race-identity/types";

const MARATHON_MIN_KM = 41.5;
const MARATHON_MAX_KM = 50;
const ULTRA_MIN_KM = 50;
const HUNDRED_KM = 100;

function marathonDistanceBand(dk: number | null | undefined): boolean {
  if (dk == null || !Number.isFinite(dk)) return false;
  return dk >= MARATHON_MIN_KM && dk < MARATHON_MAX_KM;
}

function ultraDistanceBand(dk: number | null | undefined): boolean {
  if (dk == null || !Number.isFinite(dk)) return false;
  return dk >= ULTRA_MIN_KM;
}

function hundredKmBand(dk: number | null | undefined): boolean {
  if (dk == null || !Number.isFinite(dk)) return false;
  return dk >= HUNDRED_KM;
}

function raceStub(r: Race): Pick<Race, "id" | "name" | "date"> {
  return { id: r.id, name: r.name, date: r.date ?? null };
}

/** Build identity from races already filtered to public, confirmed portfolio rows. */
export function deriveRunnerRaceIdentity(publishedConfirmedRaces: Race[]): RunnerRaceIdentity {
  const majors = new Set<string>();
  const utmbIds = new Set<string>();
  let marathonFinishes = 0;
  let ultraFinishes = 0;
  let hundredKmPlusFinishes = 0;
  let worldMajorFinishes = 0;
  let utmbSeriesFinishes = 0;
  let longest: { km: number; race: Race } | null = null;
  let maxEl: { m: number; race: Race } | null = null;
  let totalEl = 0;
  const countries = new Set<string>();
  let fastestMarathonSeconds: number | null = null;
  let fastestMarathonRace: Race | null = null;

  for (const r of publishedConfirmedRaces) {
    const dk = r.distance_km;
    if (marathonDistanceBand(dk)) marathonFinishes += 1;
    if (ultraDistanceBand(dk)) ultraFinishes += 1;
    if (hundredKmBand(dk)) hundredKmPlusFinishes += 1;

    const did = r.discover_race_id?.trim();
    if (did && WORLD_MAJOR_MARATHON_DISCOVER_IDS.has(did)) {
      worldMajorFinishes += 1;
      majors.add(did);
    }

    const prestige = getDiscoverPrestigeMeta(did ?? null);
    if (prestige?.is_utmb_series && did) {
      utmbSeriesFinishes += 1;
      utmbIds.add(did);
    }

    if (typeof dk === "number" && Number.isFinite(dk) && dk > 0) {
      if (!longest || dk > longest.km) longest = { km: dk, race: r };
    }

    const el = r.elevation_m;
    if (typeof el === "number" && Number.isFinite(el) && el > 0) {
      totalEl += el;
      if (!maxEl || el > maxEl.m) maxEl = { m: el, race: r };
    }

    const c = roughCountryFromLocation(r.location);
    if (c) countries.add(c.toLowerCase());

    if (marathonDistanceBand(dk)) {
      const sec = parseRaceClockToSeconds(r.time);
      if (sec != null && sec > 0) {
        if (fastestMarathonSeconds == null || sec < fastestMarathonSeconds) {
          fastestMarathonSeconds = sec;
          fastestMarathonRace = r;
        }
      }
    }
  }

  return {
    sourceRaceCount: publishedConfirmedRaces.length,
    marathonFinishes,
    ultraFinishes,
    hundredKmPlusFinishes,
    worldMajorFinishes,
    worldMajorDistinct: majors.size,
    utmbSeriesFinishes,
    distinctUtmbSeriesRaceIds: [...utmbIds],
    longestDistanceKm: longest?.km ?? null,
    longestDistanceRace: longest ? raceStub(longest.race) : null,
    maxElevationGainM: maxEl?.m ?? null,
    maxElevationRace: maxEl ? raceStub(maxEl.race) : null,
    totalElevationM: Math.round(totalEl),
    countriesRaced: [...countries].sort(),
    fastestMarathonSeconds,
    fastestMarathonRace: fastestMarathonRace
      ? { ...raceStub(fastestMarathonRace), time: fastestMarathonRace.time ?? null }
      : null
  };
}

function pickDate(a: string | null, b: string | null): string | null {
  if (a && b) return a < b ? a : b;
  return a ?? b ?? null;
}

export function deriveRunnerAchievements(
  publishedConfirmedRaces: Race[],
  identity: RunnerRaceIdentity
): RunnerAchievement[] {
  const out: RunnerAchievement[] = [];

  const firstMarathon = publishedConfirmedRaces
    .filter((r) => marathonDistanceBand(r.distance_km))
    .sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")))[0];
  if (firstMarathon) {
    out.push({
      id: "first_marathon",
      title: "First marathon",
      subtitle: "42 km finish on your public portfolio",
      tier: "silver",
      sortWeight: 40,
      earnedAt: firstMarathon.date ?? null
    });
  }

  const sub3 = publishedConfirmedRaces.find(
    (r) =>
      marathonDistanceBand(r.distance_km) &&
      (parseRaceClockToSeconds(r.time) ?? SUB_THREE_MARATHON_SECONDS + 1) < SUB_THREE_MARATHON_SECONDS
  );
  if (sub3) {
    out.push({
      id: "sub_3_marathon",
      title: "Sub-3 marathon",
      subtitle: "Under three hours on a standard marathon distance",
      tier: "gold",
      sortWeight: 95,
      earnedAt: sub3.date ?? null
    });
  }

  const firstUltra = publishedConfirmedRaces
    .filter((r) => ultraDistanceBand(r.distance_km))
    .sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")))[0];
  if (firstUltra) {
    out.push({
      id: "first_ultra_distance",
      title: "Ultra distance",
      subtitle: "50 km or longer finish",
      tier: "silver",
      sortWeight: 45,
      earnedAt: firstUltra.date ?? null
    });
  }

  const first100 = publishedConfirmedRaces
    .filter((r) => hundredKmBand(r.distance_km))
    .sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")))[0];
  if (first100) {
    out.push({
      id: "100km_finisher",
      title: "100 km finisher",
      subtitle: "Hundred-kilometre race on the books",
      tier: "gold",
      sortWeight: 88,
      earnedAt: first100.date ?? null
    });
  }

  if (identity.worldMajorFinishes >= 1) {
    const firstMajor = publishedConfirmedRaces
      .filter((r) => {
        const d = r.discover_race_id?.trim();
        return Boolean(d && WORLD_MAJOR_MARATHON_DISCOVER_IDS.has(d));
      })
      .sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")))[0];
    out.push({
      id: "world_major_finisher",
      title: "World Major Marathon",
      subtitle: "Verified Major on your portfolio",
      tier: "gold",
      sortWeight: 90,
      earnedAt: firstMajor?.date ?? null
    });
  }

  if (identity.worldMajorFinishes >= 3) {
    out.push({
      id: "world_major_3x",
      title: "3× Major Marathon finisher",
      subtitle: "Three Abbott World Major finishes logged",
      tier: "gold",
      sortWeight: 92,
      earnedAt: null
    });
  }

  if (identity.worldMajorDistinct >= 6) {
    out.push({
      id: "world_major_6_star",
      title: "Six Star hopeful",
      subtitle: "All six Abbott World Majors represented",
      tier: "gold",
      sortWeight: 100,
      earnedAt: null
    });
  }

  if (identity.distinctUtmbSeriesRaceIds.length >= 2) {
    const dates = publishedConfirmedRaces
      .filter((r) => {
        const d = r.discover_race_id?.trim();
        return Boolean(d && getDiscoverPrestigeMeta(d)?.is_utmb_series);
      })
      .map((r) => r.date)
      .filter(Boolean) as string[];
    const earned = dates.sort()[0] ?? null;
    out.push({
      id: "utmb_series_finisher",
      title: "UTMB Series depth",
      subtitle: "Two or more UTMB World Series events finished",
      tier: "gold",
      sortWeight: 85,
      earnedAt: earned
    });
  } else {
    const utmbFinal = publishedConfirmedRaces.find((r) => r.discover_race_id?.trim() === "disc-utmb");
    if (utmbFinal) {
      out.push({
        id: "utmb_final_finisher",
        title: "UTMB finisher",
        subtitle: "The 100-mile finals in Chamonix",
        tier: "gold",
        sortWeight: 98,
        earnedAt: utmbFinal.date ?? null
      });
    }
  }

  if (identity.countriesRaced.length >= 2) {
    out.push({
      id: "multi_country_runner",
      title: "Multi-country runner",
      subtitle: "Raced in two or more countries",
      tier: "bronze",
      sortWeight: 28,
      earnedAt: null
    });
  }

  if (identity.maxElevationGainM != null && identity.maxElevationGainM >= 4000 && identity.maxElevationRace) {
    out.push({
      id: "high_alpine_finish",
      title: "High-alpine finish",
      subtitle: "Single race with 4 000 m+ climb",
      tier: "silver",
      sortWeight: 55,
      earnedAt: identity.maxElevationRace.date ?? null
    });
  }

  const wser = publishedConfirmedRaces.find((r) => r.discover_race_id?.trim() === "disc-wser");
  if (wser) {
    out.push({
      id: "wser_finisher",
      title: "Western States finisher",
      subtitle: "Historic 100-mile trail race",
      tier: "gold",
      sortWeight: 99,
      earnedAt: wser.date ?? null
    });
  }

  const hardrock = publishedConfirmedRaces.find((r) => r.discover_race_id?.trim() === "disc-hardrock");
  if (hardrock) {
    out.push({
      id: "hardrock_finisher",
      title: "Hardrock finisher",
      subtitle: "San Juan alpine hundred",
      tier: "gold",
      sortWeight: 99,
      earnedAt: hardrock.date ?? null
    });
  }

  const tierRank = { gold: 0, silver: 1, bronze: 2 };
  out.sort((a, b) => {
    const tr = tierRank[a.tier] - tierRank[b.tier];
    if (tr !== 0) return tr;
    return b.sortWeight - a.sortWeight;
  });

  const seen = new Set<string>();
  return out.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

export function topRunnerAchievements(achievements: RunnerAchievement[], limit = 3): RunnerAchievement[] {
  return achievements.slice(0, limit);
}

export function buildRunnerIdentityPresentation(identity: RunnerRaceIdentity): RunnerIdentityPresentation {
  const n = identity.sourceRaceCount;
  const countries = identity.countriesRaced.length;
  let archetype: RunnerIdentityPresentation["archetype"] = "mixed";
  let headline = "Race portfolio";

  if (identity.ultraFinishes >= 2 || identity.hundredKmPlusFinishes >= 1) {
    archetype = "ultra";
    headline = "Ultra runner";
  } else if (identity.marathonFinishes >= 2) {
    archetype = "marathon";
    headline = "Marathoner";
  } else if (identity.marathonFinishes === 1) {
    archetype = "marathon";
    headline = "Marathon finisher";
  } else if (identity.ultraFinishes === 1) {
    archetype = "ultra";
    headline = "Ultra finisher";
  }

  if (countries >= 3) archetype = "explorer";

  const bits: string[] = [];
  if (n > 0) bits.push(`${n} published finish${n === 1 ? "" : "es"}`);
  if (countries > 0) bits.push(`${countries} ${countries === 1 ? "country" : "countries"}`);
  if (identity.worldMajorDistinct > 0) bits.push(`${identity.worldMajorDistinct}/6 World Majors`);
  if (identity.utmbSeriesFinishes > 0) bits.push(`${identity.utmbSeriesFinishes} UTMB Series finish${identity.utmbSeriesFinishes === 1 ? "" : "es"}`);

  const supportingLine = bits.length > 0 ? bits.join(" · ") : "Confirm races to build your runner story";

  return { headline, supportingLine, archetype };
}
