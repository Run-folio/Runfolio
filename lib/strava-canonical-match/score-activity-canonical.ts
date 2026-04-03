import { GENERIC_GEO_TOKENS, significantTokens } from "@/lib/match-candidate-signals";
import { normalizeRaceName } from "@/lib/races/dedupe";
import type { CanonicalRace } from "@/lib/races/canonical/types";
import {
  CANONICAL_DATE_SCORE_ZERO_BEYOND_DAYS,
  canonicalActivityYearStronglyConflictsEdition,
  canonicalTitleYearConflictsEdition,
  daysBetweenYmd
} from "@/lib/race-match-edition";
import {
  COORD_FAR_PENALTY_KM,
  countriesClearlyMismatch,
  hasUsableCanonicalGeo,
  minCoordDistanceKmCanonical
} from "@/lib/race-match-geography";
import type { RaceMatchConfidence } from "@/types";

/** Feature contributions (0–100 total target via weights). */
export type CanonicalMatchScoreBreakdown = {
  distance: number;
  elevation: number;
  location: number;
  date: number;
  name: number;
  total: number;
  reasons: string[];
};

export type ActivityForCanonicalMatch = {
  name: string;
  distanceKm: number;
  elevationM: number | null;
  /** Activity local/UTC date YYYY-MM-DD */
  startDateYmd: string;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
};

const W_DISTANCE = 28;
const W_ELEVATION = 20;
const W_LOCATION = 30;
const W_DATE = 15;
const W_NAME = 10;

function tokenOverlapScore(actName: string, raceName: string): { pts: number; reasons: string[] } {
  const ta = new Set(significantTokens(actName));
  const tb = new Set(significantTokens(raceName));
  if (ta.size === 0 || tb.size === 0) return { pts: 0, reasons: [] };
  let hit = 0;
  for (const w of ta) if (tb.has(w)) hit++;
  const j = hit / Math.max(ta.size, tb.size);
  if (j >= 0.45 && hit >= 2) return { pts: W_NAME, reasons: ["Activity title resembles the event name"] };
  if (j >= 0.28 && hit >= 2) return { pts: 7, reasons: ["Several distinctive words match the event name"] };
  if (j >= 0.22) return { pts: 4, reasons: ["Some words in the title match the event"] };
  const rNorm = normalizeRaceName(raceName);
  const aNorm = normalizeRaceName(actName);
  if (rNorm.length >= 10 && aNorm.includes(rNorm)) {
    return { pts: W_NAME, reasons: ["Activity title includes the event name"] };
  }
  const prefix = rNorm.slice(0, 10);
  if (prefix.length >= 10 && !prefix.split(" ").some((p) => GENERIC_GEO_TOKENS.has(p)) && aNorm.includes(prefix)) {
    return { pts: 6, reasons: ["Title partially overlaps a distinctive event phrase"] };
  }
  return { pts: 0, reasons: [] };
}

function distanceScore(actKm: number, raceKm: number | null): { pts: number; reasons: string[] } {
  if (raceKm == null || raceKm <= 0) {
    return { pts: Math.round(W_DISTANCE * 0.28), reasons: ["No catalog distance — using softer distance weight"] };
  }
  const ratio = Math.abs(actKm - raceKm) / raceKm;
  if (ratio <= 0.04) return { pts: W_DISTANCE, reasons: ["Distance matches the event very closely"] };
  if (ratio <= 0.09) return { pts: Math.round(W_DISTANCE * 0.85), reasons: ["Distance lines up with the event"] };
  if (ratio <= 0.16) return { pts: Math.round(W_DISTANCE * 0.55), reasons: ["Distance is plausible for this event"] };
  if (ratio <= 0.26) return { pts: Math.round(W_DISTANCE * 0.22), reasons: ["Distance is loosely in range"] };
  return { pts: 0, reasons: [] };
}

function elevationScore(
  actM: number | null,
  raceM: number | null,
  trailish: boolean
): { pts: number; reasons: string[] } {
  if (actM == null) {
    return { pts: Math.round(W_ELEVATION * 0.35), reasons: [] };
  }
  if (raceM == null || raceM <= 0) {
    const boost = trailish ? 0.45 : 0.28;
    return { pts: Math.round(W_ELEVATION * boost), reasons: ["No catalog climb — climb not compared"] };
  }
  const ratio = Math.abs(actM - raceM) / raceM;
  if (ratio <= 0.18) return { pts: W_ELEVATION, reasons: ["Vert lines up with the event"] };
  if (ratio <= 0.35) return { pts: Math.round(W_ELEVATION * 0.65), reasons: ["Vert is in the ballpark"] };
  if (ratio <= 0.55) return { pts: Math.round(W_ELEVATION * 0.35), reasons: ["Vert loosely aligns"] };
  return { pts: 0, reasons: [] };
}

function textLocationScore(
  act: ActivityForCanonicalMatch,
  race: CanonicalRace
): { pts: number; reasons: string[] } {
  const mismatch = countriesClearlyMismatch(act.country, race.country);
  if (mismatch === true) {
    return { pts: 0, reasons: ["Activity country does not match the event country"] };
  }

  const parts = [race.city, race.region, race.country].filter((x) => x?.trim());
  const blob = normalizeRaceName(parts.join(" "));
  const city = act.city ? normalizeRaceName(act.city) : "";
  const country = act.country ? normalizeRaceName(act.country) : "";
  let pts = 0;
  const reasons: string[] = [];
  if (city && city.length > 2 && blob.includes(city)) {
    const geoWeight = GENERIC_GEO_TOKENS.has(city) ? 0.2 : 0.55;
    pts += Math.round(W_LOCATION * geoWeight);
    reasons.push(GENERIC_GEO_TOKENS.has(city) ? "City matches (common hub — weak alone)" : "City lines up with the event");
  }
  if (country && blob.includes(country)) {
    pts += Math.round(W_LOCATION * 0.42);
    reasons.push("Country matches the event");
  }
  if (pts === 0 && city) {
    for (const p of parts) {
      const n = normalizeRaceName(p ?? "");
      if (n.length > 3 && (city.includes(n) || n.includes(city))) {
        const w = GENERIC_GEO_TOKENS.has(city) || GENERIC_GEO_TOKENS.has(n) ? 0.12 : 0.25;
        pts = Math.round(W_LOCATION * w);
        reasons.push("Location partially aligns");
        break;
      }
    }
  }
  return { pts: Math.min(W_LOCATION, pts), reasons };
}

function geoScore(act: ActivityForCanonicalMatch, race: CanonicalRace): { pts: number; reasons: string[] } {
  const mismatch = countriesClearlyMismatch(act.country, race.country);
  if (mismatch === true) {
    return { pts: 0, reasons: ["Activity country does not match the event country"] };
  }

  const km = minCoordDistanceKmCanonical(act, race);
  if (km != null) {
    if (km >= COORD_FAR_PENALTY_KM) {
      return { pts: 0, reasons: ["Start is very far from the catalog event location"] };
    }
    if (km <= 3) return { pts: W_LOCATION, reasons: ["Start point is right by the event"] };
    if (km <= 12) return { pts: Math.round(W_LOCATION * 0.9), reasons: ["Start is very close to the event area"] };
    if (km <= 35) return { pts: Math.round(W_LOCATION * 0.72), reasons: ["Start is near the event area"] };
    if (km <= 75) return { pts: Math.round(W_LOCATION * 0.48), reasons: ["Region matches geographically"] };
    if (km <= 120) return { pts: Math.round(W_LOCATION * 0.22), reasons: ["Rough regional match"] };
    if (km <= 350) return { pts: Math.round(W_LOCATION * 0.1), reasons: ["Same broader region — weaker signal"] };
    return { pts: Math.round(W_LOCATION * 0.04), reasons: ["Distant from event — geography is a weak match"] };
  }

  return textLocationScore(act, race);
}

function dateScore(actYmd: string, race: CanonicalRace): { pts: number; reasons: string[] } {
  const ry = race.startDate?.slice(0, 10);
  if (!ry) {
    return { pts: Math.round(W_DATE * 0.12), reasons: ["No edition date on file — timing not verified"] };
  }
  const d = daysBetweenYmd(actYmd, ry);
  if (d > CANONICAL_DATE_SCORE_ZERO_BEYOND_DAYS) {
    return { pts: 0, reasons: ["Activity date is far from this catalog edition"] };
  }
  if (d === 0) return { pts: W_DATE, reasons: ["Same day as this edition"] };
  if (d <= 1) return { pts: Math.round(W_DATE * 0.9), reasons: ["Within a day of this edition"] };
  if (d <= 3) return { pts: Math.round(W_DATE * 0.72), reasons: ["Very close to this edition date"] };
  if (d <= 7) return { pts: Math.round(W_DATE * 0.52), reasons: ["Same week as this edition"] };
  if (d <= 14) return { pts: Math.round(W_DATE * 0.24), reasons: ["Within ~two weeks of this edition"] };
  return { pts: Math.round(W_DATE * 0.07), reasons: ["Same season — weaker timing vs this edition"] };
}

/** Match hub + overview: 80+ suggested, 60–79 needs review, &lt;60 not surfaced as catalog suggestions. */
export function confidenceFromScore100(total: number): RaceMatchConfidence {
  if (total >= 80) return "high";
  if (total >= 60) return "medium";
  return "low";
}

export function scoreActivityAgainstCanonical(
  act: ActivityForCanonicalMatch,
  race: CanonicalRace
): CanonicalMatchScoreBreakdown {
  const trailish = race.isTrail === true || (race.surfaceType?.toLowerCase().includes("trail") ?? false);

  const d = distanceScore(act.distanceKm, race.distanceKm);
  const e = elevationScore(act.elevationM, race.elevationGainM, trailish);
  const g = geoScore(act, race);
  const t = dateScore(act.startDateYmd, race);
  const n = tokenOverlapScore(act.name, race.name);

  let dPts = d.pts;
  let gPts = g.pts;
  if (n.pts < 6) {
    gPts = Math.min(gPts, 10);
    dPts = Math.min(dPts, 22);
  }

  let total = Math.round(dPts + e.pts + gPts + t.pts + n.pts);

  if (countriesClearlyMismatch(act.country, race.country) === true) {
    total = Math.min(total, 52);
  } else if (!hasUsableCanonicalGeo(act) && gPts <= 7) {
    total = Math.min(total, 76);
  }

  if (canonicalTitleYearConflictsEdition(act.name, race)) {
    total = Math.min(total, 45);
  } else if (canonicalActivityYearStronglyConflictsEdition(act.startDateYmd, race)) {
    total = Math.min(total, 50);
  } else {
    const ry = race.startDate?.slice(0, 10);
    if (ry && t.pts <= 2) {
      const dayGap = daysBetweenYmd(act.startDateYmd, ry);
      if (dayGap > 21) total = Math.min(total, 68);
    }
  }

  const reasons = [...d.reasons, ...e.reasons, ...g.reasons, ...t.reasons, ...n.reasons].filter(Boolean);
  const uniq = reasons.length ? [...new Set(reasons)] : ["Limited overlap — only confirm if this was your race"];

  return {
    distance: dPts,
    elevation: e.pts,
    location: gPts,
    date: t.pts,
    name: n.pts,
    total: Math.min(100, total),
    reasons: uniq
  };
}

export function explanationSummary(b: CanonicalMatchScoreBreakdown): string {
  return b.reasons.slice(0, 3).join(" · ");
}
