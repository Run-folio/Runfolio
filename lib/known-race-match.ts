import type { DiscoverRace } from "@/lib/discover-race-schema";
import { buildCatalogAliasMap, buildCatalogTypicalMonths, discoverRaces } from "@/lib/discover-races";
import type { ActivityMatchInput, Race, RaceMatchCandidate, RaceMatchConfidence } from "@/types";

/** Score at or above this is treated as “high confidence” in UI (still requires confirm for bucket mutations). */
export const RACE_MATCH_HIGH_SCORE = 0.72;

/** Extra phrases not worth auto-merging into catalog JSON (override / supplement). */
const EXTRA_ALIASES: Record<string, string[]> = {
  "disc-boston": ["bq", "boston 26.2"],
  "disc-chicago": ["chicago pb", "windy city marathon"],
  "disc-nyc": ["new york city marathon"]
};

function mergeAliasMaps(
  base: Record<string, string[]>,
  extra: Record<string, string[]>
): Record<string, string[]> {
  const out: Record<string, string[]> = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    out[k] = [...new Set([...(out[k] ?? []), ...v])];
  }
  return out;
}

/** Extra tokens / phrases → discover race id (merged from modular catalog + extras). */
export const DISCOVER_RACE_ALIASES: Record<string, string[]> = mergeAliasMaps(buildCatalogAliasMap(), EXTRA_ALIASES);

export const DISCOVER_TYPICAL_MONTHS: Record<string, number[]> = {
  ...buildCatalogTypicalMonths()
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

function distanceScoreForDiscover(discover: DiscoverRace, actKm: number): { score: number; reasons: string[] } {
  if (!actKm) return { score: 0, reasons: [] };
  const distances = [discover.distance_km, ...(discover.distance_variants_km ?? [])].filter((x) => x > 0);
  let bestScore = 0;
  let bestReasons: string[] = [];
  for (const dk of distances) {
    const ratio = Math.abs(actKm - dk) / dk;
    let sc = 0;
    let rs: string[] = [];
    if (ratio <= 0.06) {
      sc = 0.3;
      rs = ["Distance closely matches the race"];
    } else if (ratio <= 0.12) {
      sc = 0.22;
      rs = ["Distance aligns with the race"];
    } else if (ratio <= 0.2) {
      sc = 0.12;
      rs = ["Distance is in range for this race"];
    } else if (ratio <= 0.28) {
      sc = 0.05;
      rs = ["Distance is loosely in range"];
    }
    if (sc > bestScore) {
      bestScore = sc;
      bestReasons = rs;
    }
  }
  return { score: bestScore, reasons: bestReasons };
}

function aliasMatchesDiscoverTitle(act: ActivityMatchInput, discover: DiscoverRace, aliasRaw: string): boolean {
  const na = normalize(aliasRaw);
  const t = normalize(act.name);
  if (na.length < 2 || !t.includes(na)) return false;

  const distances = [discover.distance_km, ...(discover.distance_variants_km ?? [])].filter((x) => x > 0);
  let bestRatio = 1;
  for (const dk of distances) {
    if (dk > 0) bestRatio = Math.min(bestRatio, Math.abs(act.distance_km - dk) / dk);
  }

  if (na.length <= 10) {
    if (discover.surface === "road" && Math.abs(discover.distance_km - 42.2) < 3) {
      if (bestRatio > 0.16) return false;
    } else if (bestRatio > 0.3) return false;
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

function elevationBonusHeuristic(discover: DiscoverRace, act: ActivityMatchInput): { score: number; reasons: string[] } {
  if (act.elevation_m == null || discover.surface !== "trail") return { score: 0, reasons: [] };
  const dKm = discover.distance_km;
  const rough = dKm * 50;
  const diff = Math.abs(act.elevation_m - rough) / Math.max(rough, 1);
  if (diff < 0.45) return { score: 0.08, reasons: ["Elevation profile fits a mountain ultra"] };
  return { score: 0, reasons: [] };
}

function elevationProfileScore(discover: DiscoverRace, act: ActivityMatchInput): { score: number; reasons: string[] } {
  if (act.elevation_m == null) return { score: 0, reasons: [] };
  const est = discover.elevation_m_est;
  if (est != null && est > 200 && discover.surface !== "road") {
    const diff = Math.abs(act.elevation_m - est) / est;
    if (diff < 0.22) return { score: 0.12, reasons: ["Elevation close to typical course profile"] };
    if (diff < 0.4) return { score: 0.07, reasons: ["Elevation roughly matches this course"] };
  }
  return elevationBonusHeuristic(discover, act);
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
  const d = distanceScoreForDiscover(discover, activity.distance_km);
  const l = locationScore(discover, activity);
  const e = elevationProfileScore(discover, activity);
  const sp = sportBonus(discover, activity);
  const dt = dateProximityScore(discover.id, activity.date);
  let score = Math.min(1, t.score + d.score + l.score + e.score + sp + dt.score);
  const boost = discover.match_boost ?? 0;
  score = Math.min(1, score + boost);
  const reasons = [...t.reasons, ...d.reasons, ...l.reasons, ...e.reasons, ...dt.reasons];
  if (sp > 0) reasons.push("Sport type fits the event");
  if (boost >= 0.06) reasons.push("Boost: flagship / series event in catalog");
  return {
    score: Math.round(score * 100) / 100,
    reasons: [...new Set(reasons)].slice(0, 10),
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

function shouldSkipDiscoverForActivity(discover: DiscoverRace, activity: ActivityMatchInput): boolean {
  if (activity.distance_km >= 50) {
    if (discover.surface === "road" && discover.distance_km < 45) return true;
  }
  return false;
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
    if (shouldSkipDiscoverForActivity(discover, activity)) continue;
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

/**
 * True when a long trail/ultra effort has no strong catalog match — offer “custom major effort” save.
 */
export function isUnmatchedMajorEffortCandidate(
  activity: ActivityMatchInput,
  ranked: RaceMatchCandidate[]
): boolean {
  if (activity.distance_km < 50) return false;
  const best = ranked[0]?.score ?? 0;
  return best < 0.42;
}
