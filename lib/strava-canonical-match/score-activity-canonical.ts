import { normalizeRaceName } from "@/lib/races/dedupe";
import type { CanonicalRace } from "@/lib/races/canonical/types";
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

const W_DISTANCE = 30;
const W_ELEVATION = 20;
const W_LOCATION = 25;
const W_DATE = 15;
const W_NAME = 10;

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function daysBetweenYmd(a: string, b: string): number {
  const da = new Date(`${a.slice(0, 10)}T12:00:00Z`).getTime();
  const db = new Date(`${b.slice(0, 10)}T12:00:00Z`).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return 999;
  return Math.round(Math.abs(da - db) / 86400000);
}

function tokenOverlapScore(actName: string, raceName: string): { pts: number; reasons: string[] } {
  const ta = new Set(
    normalizeRaceName(actName)
      .split(" ")
      .filter((w) => w.length > 2)
  );
  const tb = new Set(
    normalizeRaceName(raceName)
      .split(" ")
      .filter((w) => w.length > 2)
  );
  if (ta.size === 0 || tb.size === 0) return { pts: 0, reasons: [] };
  let hit = 0;
  for (const w of ta) if (tb.has(w)) hit++;
  const j = hit / Math.max(ta.size, tb.size);
  if (j >= 0.45) return { pts: W_NAME, reasons: ["Activity title resembles the event name"] };
  if (j >= 0.22) return { pts: 6, reasons: ["Some words in the title match the event"] };
  if (normalizeRaceName(actName).includes(normalizeRaceName(raceName).slice(0, 8)) && raceName.length > 6) {
    return { pts: 5, reasons: ["Title partially overlaps the event name"] };
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
  const parts = [race.city, race.region, race.country].filter((x) => x?.trim());
  const blob = normalizeRaceName(parts.join(" "));
  const city = act.city ? normalizeRaceName(act.city) : "";
  const country = act.country ? normalizeRaceName(act.country) : "";
  let pts = 0;
  const reasons: string[] = [];
  if (city && city.length > 2 && blob.includes(city)) {
    pts += Math.round(W_LOCATION * 0.55);
    reasons.push("City lines up with the event");
  }
  if (country && blob.includes(country)) {
    pts += Math.round(W_LOCATION * 0.35);
    reasons.push("Country matches the event");
  }
  if (pts === 0 && city) {
    for (const p of parts) {
      const n = normalizeRaceName(p ?? "");
      if (n.length > 3 && (city.includes(n) || n.includes(city))) {
        pts = Math.round(W_LOCATION * 0.25);
        reasons.push("Location partially aligns");
        break;
      }
    }
  }
  return { pts: Math.min(W_LOCATION, pts), reasons };
}

function geoScore(act: ActivityForCanonicalMatch, race: CanonicalRace): { pts: number; reasons: string[] } {
  if (
    act.latitude == null ||
    act.longitude == null ||
    race.latitude == null ||
    race.longitude == null
  ) {
    return textLocationScore(act, race);
  }
  const km = haversineKm(act.latitude, act.longitude, race.latitude, race.longitude);
  if (km <= 3) return { pts: W_LOCATION, reasons: ["Start point is right by the event"] };
  if (km <= 15) return { pts: Math.round(W_LOCATION * 0.82), reasons: ["Start is near the event area"] };
  if (km <= 45) return { pts: Math.round(W_LOCATION * 0.45), reasons: ["Region matches geographically"] };
  if (km <= 120) return { pts: Math.round(W_LOCATION * 0.15), reasons: ["Rough regional match"] };
  const text = textLocationScore(act, race);
  return { pts: Math.min(text.pts, Math.round(W_LOCATION * 0.2)), reasons: text.reasons };
}

function dateScore(actYmd: string, race: CanonicalRace): { pts: number; reasons: string[] } {
  const ry = race.startDate?.slice(0, 10);
  if (!ry) return { pts: Math.round(W_DATE * 0.25), reasons: ["Event date unknown — date skipped"] };
  const d = daysBetweenYmd(actYmd, ry);
  if (d === 0) return { pts: W_DATE, reasons: ["Same day as the event"] };
  if (d <= 1) return { pts: Math.round(W_DATE * 0.88), reasons: ["Within a day of the event"] };
  if (d <= 3) return { pts: Math.round(W_DATE * 0.65), reasons: ["Very close to the event weekend"] };
  if (d <= 7) return { pts: Math.round(W_DATE * 0.4), reasons: ["Same week as the event"] };
  if (d <= 14) return { pts: Math.round(W_DATE * 0.15), reasons: ["Roughly the same period"] };
  return { pts: 0, reasons: [] };
}

export function confidenceFromScore100(total: number): RaceMatchConfidence {
  if (total >= 72) return "high";
  if (total >= 48) return "medium";
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

  const total = Math.round(d.pts + e.pts + g.pts + t.pts + n.pts);
  const reasons = [...d.reasons, ...e.reasons, ...g.reasons, ...t.reasons, ...n.reasons].filter(Boolean);
  const uniq = reasons.length ? [...new Set(reasons)] : ["Limited overlap — only confirm if this was your race"];

  return {
    distance: d.pts,
    elevation: e.pts,
    location: g.pts,
    date: t.pts,
    name: n.pts,
    total: Math.min(100, total),
    reasons: uniq
  };
}

export function explanationSummary(b: CanonicalMatchScoreBreakdown): string {
  return b.reasons.slice(0, 3).join(" · ");
}
