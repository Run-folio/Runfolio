import type { DiscoverRace } from "@/lib/discover-races";
import { discoverRaces } from "@/lib/discover-races";
import type { ActivityMatchInput, Race, RaceMatchCandidate, RaceMatchConfidence } from "@/types";

/** Score at or above this is treated as “high confidence” in UI (still requires confirm for bucket mutations). */
export const RACE_MATCH_HIGH_SCORE = 0.72;

/** Extra tokens / phrases → discover race id (lowercase). */
export const DISCOVER_RACE_ALIASES: Record<string, string[]> = {
  "disc-ccc": ["ccc", "utmb ccc", "courmayeur", "chamonix ccc", "100k utmb"],
  "disc-utmb": ["utmb", "ultra-trail du mont-blanc", "ultra trail du mont blanc", "mont blanc"],
  "disc-occ": ["occ", "orsieres", "orcières"],
  "disc-tds": ["tds", "sur les traces", "ducs de savoie"],
  "disc-etr": ["etr", "trail des géants"],
  "disc-lavaredo": ["lavaredo", "cortina", "ultra trail cortina"],
  "disc-wser": ["western states", "ws100", "western states 100", "squaw"],
  "disc-hardrock": ["hardrock", "hard rock 100", "hardrock100"],
  "disc-leadville": ["leadville", "lt100", "leadville trail"],
  "disc-diagonale": ["diagonale", "grand raid", "réunion", "reunion", "diagonale des fous"],
  "disc-boston": ["boston marathon", "boston strong", "boston 26.2", "boston", "bq"],
  "disc-chicago": [
    "chicago marathon",
    "bank of america chicago",
    "bank of america chicago marathon",
    "chicago",
    "chicago pb",
    "windy city marathon"
  ],
  "disc-nyc": ["tcs nyc", "new york marathon", "nyc marathon", "new york city marathon"],
  "disc-london": ["london marathon", "virgin money london", "london landmarks"],
  "disc-berlin": ["berlin marathon"],
  "disc-tokyo": ["tokyo marathon"],
  "disc-valencia": ["valencia marathon", "maraton valencia"],
  "disc-paris": ["paris marathon", "schneider electric paris"],
  "disc-mds": ["marathon des sables", "mds", "sahara"],
  "disc-badwater": ["badwater", "135"],
  "disc-spartathlon": ["spartathlon", "athens to sparta"],
  "disc-tor": ["tor des géants", "tor des geants", "tdg"],
  "disc-moab": ["moab 240", "moab"],
  "disc-pikes": ["pikes peak", "pikes peak marathon"],
  "disc-two-oceans": ["two oceans", "cape town ultra"]
};

/**
 * Typical calendar months (1–12) when the event usually occurs — used as a soft signal with distance/title.
 */
export const DISCOVER_TYPICAL_MONTHS: Record<string, number[]> = {
  "disc-tokyo": [3],
  "disc-boston": [4],
  "disc-london": [4],
  "disc-paris": [4],
  "disc-mds": [4],
  "disc-wser": [6, 7],
  "disc-hardrock": [7],
  "disc-utmb": [8, 9],
  "disc-ccc": [8, 9],
  "disc-occ": [8, 9],
  "disc-tds": [8, 9],
  "disc-etr": [8, 9],
  "disc-leadville": [8],
  "disc-berlin": [9],
  "disc-chicago": [10],
  "disc-nyc": [11],
  "disc-valencia": [12]
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(normalize(a).split(" ").filter((w) => w.length > 2));
  const tb = new Set(normalize(b).split(" ").filter((w) => w.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let hit = 0;
  for (const w of ta) if (tb.has(w)) hit++;
  return hit / Math.max(ta.size, tb.size);
}

function locationScore(discover: DiscoverRace, act: ActivityMatchInput): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const blob = normalize(discover.location);
  const city = act.location_city ? normalize(act.location_city) : "";
  const country = act.location_country ? normalize(act.location_country) : "";
  let s = 0;
  if (city && city.length > 2 && blob.includes(city)) {
    s += 0.22;
    reasons.push(`Location matches (${act.location_city})`);
  } else if (city) {
    const parts = blob.split(" ").filter((p) => p.length > 3);
    for (const p of parts) {
      if (city.includes(p) || p.includes(city)) {
        s += 0.14;
        reasons.push("Location partially matches race region");
        break;
      }
    }
  }
  if (country && blob.includes(country)) {
    s += 0.1;
    reasons.push(`Country matches (${act.location_country})`);
  }
  return { score: Math.min(s, 0.28), reasons };
}

function distanceScore(discoverKm: number, actKm: number): { score: number; reasons: string[] } {
  if (!actKm || !discoverKm) return { score: 0, reasons: [] };
  const ratio = Math.abs(actKm - discoverKm) / discoverKm;
  if (ratio <= 0.06) return { score: 0.3, reasons: ["Distance closely matches the race"] };
  if (ratio <= 0.12) return { score: 0.22, reasons: ["Distance aligns with the race"] };
  if (ratio <= 0.2) return { score: 0.12, reasons: ["Distance is in range for this race"] };
  if (ratio <= 0.28) return { score: 0.05, reasons: ["Distance is loosely in range"] };
  return { score: 0, reasons: [] };
}

function aliasMatchesDiscoverTitle(act: ActivityMatchInput, discover: DiscoverRace, aliasRaw: string): boolean {
  const na = normalize(aliasRaw);
  const t = normalize(act.name);
  if (na.length < 2 || !t.includes(na)) return false;

  const ratio =
    discover.distance_km > 0 ? Math.abs(act.distance_km - discover.distance_km) / discover.distance_km : 1;

  if (na.length <= 10) {
    if (discover.surface === "road" && Math.abs(discover.distance_km - 42.2) < 3) {
      if (ratio > 0.16) return false;
    } else if (ratio > 0.3) return false;
  }
  return true;
}

function dateProximityScore(discoverId: string, isoDate: string): { score: number; reasons: string[] } {
  const months = DISCOVER_TYPICAL_MONTHS[discoverId];
  if (!months?.length || !isoDate) return { score: 0, reasons: [] };
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return { score: 0, reasons: [] };
  const m = d.getMonth() + 1;
  if (months.includes(m)) {
    return { score: 0.14, reasons: ["Date lines up with the usual race month"] };
  }
  for (const tm of months) {
    const prev = tm === 1 ? 12 : tm - 1;
    const next = tm === 12 ? 1 : tm + 1;
    if (m === prev || m === next) {
      return { score: 0.07, reasons: ["Date is close to the typical race season"] };
    }
  }
  return { score: 0, reasons: [] };
}

function titleScore(discover: DiscoverRace, act: ActivityMatchInput): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const t = normalize(act.name);
  const name = normalize(discover.name);
  let s = 0;
  if (t.includes(name) || name.includes(t)) {
    s += 0.48;
    reasons.push("Activity title matches the race name");
  } else {
    const ov = tokenOverlap(act.name, discover.name);
    if (ov >= 0.5) {
      s += 0.32;
      reasons.push("Activity title overlaps the race name");
    } else if (ov >= 0.25) {
      s += 0.14;
      reasons.push("Activity title partially matches the race name");
    }
  }
  const aliases = DISCOVER_RACE_ALIASES[discover.id] ?? [];
  for (const a of aliases) {
    if (!aliasMatchesDiscoverTitle(act, discover, a)) continue;
    const na = normalize(a);
    if (na.length > 1) {
      s += 0.4;
      reasons.push(`Title matches known alias (“${a}”)`);
      break;
    }
  }
  return { score: Math.min(s, 0.58), reasons };
}

function elevationBonus(discover: DiscoverRace, act: ActivityMatchInput): { score: number; reasons: string[] } {
  if (act.elevation_m == null || discover.surface !== "trail") return { score: 0, reasons: [] };
  const dKm = discover.distance_km;
  const rough = dKm * 50;
  const diff = Math.abs(act.elevation_m - rough) / Math.max(rough, 1);
  if (diff < 0.45) return { score: 0.08, reasons: ["Elevation profile fits a mountain ultra"] };
  return { score: 0, reasons: [] };
}

function sportBonus(discover: DiscoverRace, act: ActivityMatchInput): number {
  const st = `${act.sport_type ?? ""} ${act.type ?? ""}`.toLowerCase();
  if (!st.includes("run") && !st.includes("walk") && !st.includes("hike")) return 0;
  if (discover.surface === "trail" && (st.includes("trail") || st.includes("run"))) return 0.05;
  if (discover.surface === "road" && st.includes("run")) return 0.04;
  return 0.02;
}

function confidenceFromScore(score: number): RaceMatchConfidence {
  if (score >= RACE_MATCH_HIGH_SCORE) return "high";
  if (score >= 0.48) return "medium";
  return "low";
}

/** Score one catalog race against a Strava-like activity (symmetric with `rankKnownRaceMatches`). */
export function scoreActivityAgainstDiscover(
  discover: DiscoverRace,
  activity: ActivityMatchInput
): { score: number; reasons: string[]; confidence: RaceMatchConfidence } {
  const t = titleScore(discover, activity);
  const d = distanceScore(discover.distance_km, activity.distance_km);
  const l = locationScore(discover, activity);
  const e = elevationBonus(discover, activity);
  const sp = sportBonus(discover, activity);
  const dt = dateProximityScore(discover.id, activity.date);
  const score = Math.min(1, t.score + d.score + l.score + e.score + sp + dt.score);
  const reasons = [...t.reasons, ...d.reasons, ...l.reasons, ...e.reasons, ...dt.reasons];
  if (sp > 0) reasons.push("Sport type fits the event");
  return {
    score: Math.round(score * 100) / 100,
    reasons: [...new Set(reasons)].slice(0, 8),
    confidence: confidenceFromScore(score)
  };
}

function findBucketListRace(userRaces: Race[], discover: DiscoverRace): Race | null {
  const future = userRaces.filter((r) => !r.is_completed);
  let best: { r: Race; sc: number } | null = null;
  const nameN = normalize(discover.name);
  const aliasBlob = (DISCOVER_RACE_ALIASES[discover.id] ?? []).map(normalize).join(" ");
  for (const r of future) {
    const rn = normalize(r.name);
    let sc = tokenOverlap(r.name, discover.name);
    if (rn.includes(nameN) || nameN.includes(rn)) sc = Math.max(sc, 0.85);
    for (const a of DISCOVER_RACE_ALIASES[discover.id] ?? []) {
      const na = normalize(a);
      if (na.length > 2 && rn.includes(na)) sc = Math.max(sc, 0.75);
    }
    if (aliasBlob && rn.length > 3) {
      for (const part of aliasBlob.split(" ")) {
        if (part.length > 3 && rn.includes(part)) sc = Math.max(sc, 0.55);
      }
    }
    if (sc >= 0.35 && (!best || sc > best.sc)) best = { r, sc };
  }
  return best?.r ?? null;
}

/**
 * Rank known major races for a Strava-like activity. Does not auto-apply — UI confirms.
 */
export function rankKnownRaceMatches(
  activity: ActivityMatchInput,
  userRaces: Race[],
  minScore = 0.32
): RaceMatchCandidate[] {
  const out: RaceMatchCandidate[] = [];
  for (const discover of discoverRaces) {
    const { score, reasons, confidence } = scoreActivityAgainstDiscover(discover, activity);
    if (score < minScore) continue;
    const bucket = findBucketListRace(userRaces, discover);
    out.push({
      discoverRaceId: discover.id,
      title: discover.name,
      location: discover.location,
      distanceKm: discover.distance_km,
      confidence,
      score,
      reasons: reasons.slice(0, 6),
      onUserBucketList: Boolean(bucket),
      userRaceId: bucket?.id ?? null
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}

export function getDiscoverRaceById(id: string): DiscoverRace | undefined {
  return discoverRaces.find((r) => r.id === id);
}
