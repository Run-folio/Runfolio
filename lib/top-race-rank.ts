import type { Race } from "@/types";
import { getDiscoverPrestigeMeta, unmatchedEffortPrestige, type DiscoverPrestigeMeta } from "@/lib/discover-race-prestige";

const WEIGHT_PRESTIGE = 1.15;
const WEIGHT_DISTANCE = 22;
const WEIGHT_ELEVATION = 14;
const BONUS_CONFIRMED_CATALOG = 14;
const BONUS_VIRTUAL_HIGH_MATCH = 7;
const BONUS_TAG_CAREER = 16;
const BONUS_TAG_PB = 13;
const BONUS_TAG_HARDEST = 11;
const BONUS_TAG_BUCKET_DONE = 9;
const RECENCY_CAP = 6;

export type TopRaceBadgeKind =
  | "career_highlight"
  | "pr"
  | "hardest"
  | "bucket_done"
  | "major_marathon"
  | "utmb_series"
  | "100_miler"
  | "iconic_ultra";

export type TopRaceBadge = {
  kind: TopRaceBadgeKind;
  label: string;
  /** 'gold' | 'accent' | 'muted' for styling */
  tone: "gold" | "accent" | "muted";
};

export type RankedTopRace = {
  race: Race;
  score: number;
  prestige: DiscoverPrestigeMeta;
  badges: TopRaceBadge[];
};

function parseYear(date: string | null): number | null {
  if (!date) return null;
  const y = Number(String(date).slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

/** Small nudge for recent finishes — capped so prestige/distance stay dominant. */
function recencyBonus(date: string | null): number {
  const y = parseYear(date);
  if (y == null) return 0;
  const now = new Date().getFullYear();
  const age = Math.max(0, now - y);
  if (age <= 0) return RECENCY_CAP;
  if (age === 1) return 5;
  if (age <= 2) return 4;
  if (age <= 4) return 2;
  if (age <= 7) return 1;
  return 0;
}

function distanceComponent(km: number | null): number {
  const k = Number(km) || 0;
  return Math.min(28, Math.log1p(Math.max(0, k)) * WEIGHT_DISTANCE * 0.42);
}

function elevationComponent(m: number | null): number {
  const e = Number(m) || 0;
  return Math.min(22, Math.log1p(Math.max(0, e)) * WEIGHT_ELEVATION * 0.11);
}

function isStravaVirtual(race: Race): boolean {
  return race.id.startsWith("strava-virt-");
}

function resolvePrestige(race: Race): DiscoverPrestigeMeta {
  const fromCatalog = getDiscoverPrestigeMeta(race.discover_race_id);
  if (fromCatalog) return fromCatalog;
  return unmatchedEffortPrestige(Number(race.distance_km) || 0);
}

function buildBadges(race: Race, p: DiscoverPrestigeMeta): TopRaceBadge[] {
  const out: TopRaceBadge[] = [];

  if (race.tag_career_highlight) {
    out.push({ kind: "career_highlight", label: "Career highlight", tone: "gold" });
  }
  if (race.tag_pb) {
    out.push({ kind: "pr", label: "PR", tone: "gold" });
  }
  if (race.tag_hardest) {
    out.push({ kind: "hardest", label: "Hardest race", tone: "accent" });
  }
  if (race.tag_bucket_list_done) {
    out.push({ kind: "bucket_done", label: "Bucket list done", tone: "accent" });
  }

  const prestigeBadges: TopRaceBadge[] = [];
  if (p.is_hundred_miler) {
    prestigeBadges.push({ kind: "100_miler", label: "100 mi", tone: "gold" });
  } else if (p.is_iconic_ultra) {
    prestigeBadges.push({ kind: "iconic_ultra", label: "Iconic ultra", tone: "gold" });
  }
  if (p.is_utmb_series && race.discover_race_id !== "disc-utmb") {
    prestigeBadges.push({ kind: "utmb_series", label: "UTMB series", tone: "accent" });
  } else if (p.is_major_marathon) {
    prestigeBadges.push({ kind: "major_marathon", label: "Major marathon", tone: "accent" });
  }

  const maxPrestigeSlots = Math.max(0, 2 - out.length);
  out.push(...prestigeBadges.slice(0, maxPrestigeSlots));

  return out.slice(0, 3);
}

/**
 * Weighted score: prestige tier/base, distance, elevation, confirmed catalog vs virtual,
 * user tags, tiny recency. Higher = more “portfolio defining”.
 */
export function computeTopRaceScore(race: Race): number {
  const p = resolvePrestige(race);
  let score = p.prestige_base * WEIGHT_PRESTIGE;
  score += distanceComponent(race.distance_km);
  score += elevationComponent(race.elevation_m);

  if (race.discover_race_id) {
    score += isStravaVirtual(race) ? BONUS_VIRTUAL_HIGH_MATCH : BONUS_CONFIRMED_CATALOG;
  }

  if (race.tag_career_highlight) score += BONUS_TAG_CAREER;
  if (race.tag_pb) score += BONUS_TAG_PB;
  if (race.tag_hardest) score += BONUS_TAG_HARDEST;
  if (race.tag_bucket_list_done) score += BONUS_TAG_BUCKET_DONE;

  score += recencyBonus(race.date);

  return Math.round(score * 100) / 100;
}

function tieBreak(a: Race, b: Race, scoreA: number, scoreB: number): number {
  if (scoreA !== scoreB) return scoreB - scoreA;
  const pa = resolvePrestige(a);
  const pb = resolvePrestige(b);
  if (pa.race_tier !== pb.race_tier) return pa.race_tier - pb.race_tier;
  if (pa.prestige_base !== pb.prestige_base) return pb.prestige_base - pa.prestige_base;
  const da = Number(a.distance_km) || 0;
  const db = Number(b.distance_km) || 0;
  if (da !== db) return db - da;
  const ea = Number(a.elevation_m) || 0;
  const eb = Number(b.elevation_m) || 0;
  if (ea !== eb) return eb - ea;
  return String(b.date ?? "").localeCompare(String(a.date ?? ""));
}

export function rankRacesForProfileTopRaces(races: Race[]): RankedTopRace[] {
  const ranked = races.map((race) => {
    const prestige = resolvePrestige(race);
    const score = computeTopRaceScore(race);
    return {
      race,
      score,
      prestige,
      badges: buildBadges(race, prestige)
    };
  });
  ranked.sort((x, y) => tieBreak(x.race, y.race, x.score, y.score));
  return ranked;
}
