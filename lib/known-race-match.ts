import {
  GENERIC_GEO_TOKENS,
  distinctiveTokens,
  hasStrongTitleEvidence,
  significantTokens
} from "@/lib/match-candidate-signals";
import { discoverGeographyHardBlock, haversineKm } from "@/lib/race-match-geography";
import type { DiscoverRace } from "@/lib/discover-race-schema";
import { buildCatalogAliasMap, buildCatalogTypicalMonths, discoverRaces } from "@/lib/discover-races";
import type { StravaSummaryActivityJson } from "@/lib/strava-api";
import type { ActivityMatchInput, Race, RaceMatchCandidate, RaceMatchConfidence } from "@/types";

/** Score at or above this is treated as “high confidence” for auto-suggestion surfaces (aligned with canonical 80/100). */
export const RACE_MATCH_HIGH_SCORE = 0.8;

/** Curated catalog aliases only (see `match_include_name_tokens` on records for rare token expansion). */
export const DISCOVER_RACE_ALIASES: Record<string, string[]> = buildCatalogAliasMap();

export const DISCOVER_TYPICAL_MONTHS: Record<string, number[]> = {
  ...buildCatalogTypicalMonths()
};

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(normalize(a).split(" ").filter((w) => w.length > 2));
  const tb = new Set(normalize(b).split(" ").filter((w) => w.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let hit = 0;
  for (const w of ta) if (tb.has(w)) hit++;
  return hit / Math.max(ta.size, tb.size);
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function discoverGeoTextBlob(discover: DiscoverRace): string {
  return [
    discover.location,
    discover.city,
    discover.region_state,
    discover.country,
    discover.official_name,
    discover.name
  ]
    .filter(Boolean)
    .join(" ");
}

function coordProximityScore(discover: DiscoverRace, act: ActivityMatchInput): { score: number; reasons: string[] } {
  if (
    act.start_latitude == null ||
    act.start_longitude == null ||
    discover.latitude == null ||
    discover.longitude == null
  ) {
    return { score: 0, reasons: [] };
  }
  const km = haversineKm(act.start_latitude, act.start_longitude, discover.latitude, discover.longitude);
  if (km >= 2200) {
    return { score: -0.1, reasons: ["Start coordinates are far from the catalog event hub"] };
  }
  if (km <= 55) {
    return { score: 0.12, reasons: ["Start coordinates align with the event area"] };
  }
  if (km <= 200) {
    return { score: 0.06, reasons: ["Start coordinates are in the broader event region"] };
  }
  return { score: 0, reasons: [] };
}

function locationScore(discover: DiscoverRace, act: ActivityMatchInput): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  if (discoverGeographyHardBlock(act, discover)) {
    return {
      score: 0,
      reasons: ["Strava geography does not match the catalog event (country or coordinates)"]
    };
  }
  const blob = normalize(discoverGeoTextBlob(discover));
  const city = act.location_city ? normalize(act.location_city) : "";
  const country = act.location_country ? normalize(act.location_country) : "";
  const cityHubTokens = city
    ? city.split(" ").filter((w) => w.length > 2)
    : [];
  const cityGenericOnly =
    cityHubTokens.length > 0 && cityHubTokens.every((w) => GENERIC_GEO_TOKENS.has(w));

  let s = 0;
  if (city && city.length > 2 && blob.includes(city)) {
    s += cityGenericOnly ? 0.07 : 0.22;
    reasons.push(
      cityGenericOnly
        ? `Location mentions a major hub (${act.location_city}) — weak without title`
        : `Location matches (${act.location_city})`
    );
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
    s += 0.14;
    reasons.push(`Country aligns with catalog location (${act.location_country})`);
  }
  return { score: Math.min(s, 0.34), reasons };
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

function parseYmd(iso: string): { y: number; m: number; d: number } | null {
  const ymd = iso.slice(0, 10);
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!parts) return null;
  const y = Number(parts[1]);
  const m = Number(parts[2]);
  const d = Number(parts[3]);
  if (![y, m, d].every((n) => Number.isFinite(n))) return null;
  return { y, m, d };
}

/** Distance in days from activity date to anchor month/day rolled into the activity’s calendar year. */
function daysFromRecurringAnchor(activityIso: string, anchorYmd: string): number | null {
  const act = parseYmd(activityIso);
  const anc = parseYmd(anchorYmd);
  if (!act || !anc) return null;
  const tAct = Date.UTC(act.y, act.m - 1, act.d);
  const tSyn = Date.UTC(act.y, anc.m - 1, anc.d);
  return Math.round(Math.abs(tAct - tSyn) / 86400000);
}

function typicalMonthsForDiscover(discover: DiscoverRace): number[] {
  if (discover.typical_months?.length) return discover.typical_months;
  return DISCOVER_TYPICAL_MONTHS[discover.id] ?? [];
}

/**
 * Edition-aware date signal: optional recurring anchor window, else typical months, scaled by `edition_date_quality`.
 */
function dateProximityScore(discover: DiscoverRace, isoDate: string): { score: number; reasons: string[] } {
  const quality = discover.edition_date_quality ?? "month_typical";

  if (discover.edition_date_anchor_ymd && quality === "anchor") {
    const days = daysFromRecurringAnchor(isoDate, discover.edition_date_anchor_ymd);
    if (days != null) {
      const windowDays = discover.edition_date_window_days ?? 21;
      if (days <= windowDays) {
        return {
          score: 0.2,
          reasons: ["Date aligns with the catalog’s typical race window"]
        };
      }
      if (days <= windowDays * 2) {
        return {
          score: 0.1,
          reasons: ["Date is near the catalog’s typical race window"]
        };
      }
      return {
        score: -0.12,
        reasons: ["Date is outside the typical window for this recurring event"]
      };
    }
  }

  const months = typicalMonthsForDiscover(discover);
  if (!months.length || !isoDate) return { score: 0, reasons: [] };
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return { score: 0, reasons: [] };
  const m = d.getMonth() + 1;

  if (months.includes(m)) {
    const bonus =
      quality === "sparse" ? 0.08 : quality === "month_relaxed" ? 0.12 : 0.14;
    const reason =
      quality === "sparse"
        ? "Date falls in a typical race month (catalog date detail is sparse)"
        : "Date lines up with the usual race month";
    return { score: bonus, reasons: [reason] };
  }

  for (const tm of months) {
    const prev = tm === 1 ? 12 : tm - 1;
    const next = tm === 12 ? 1 : tm + 1;
    if (m === prev || m === next) {
      const adj = quality === "month_relaxed" ? 0.1 : quality === "sparse" ? 0.04 : 0.07;
      return { score: adj, reasons: ["Date is close to the typical race season"] };
    }
  }

  if (quality === "sparse") return { score: 0, reasons: [] };

  const pen = quality === "month_relaxed" ? -0.04 : -0.07;
  return {
    score: pen,
    reasons: ["Activity month is not near the typical race season for this event"]
  };
}

function titleScore(discover: DiscoverRace, act: ActivityMatchInput): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const aliasList = [...(DISCOVER_RACE_ALIASES[discover.id] ?? []), ...(discover.aliases ?? [])];

  for (const phrase of aliasList) {
    if (!aliasMatchesDiscoverTitle(act, discover, phrase)) continue;
    const na = normalize(phrase);
    if (na.length < 2) continue;
    return { score: 0.46, reasons: [`Title matches catalog cue (“${phrase}”)`] };
  }

  const t = normalize(act.name);
  const displayNames = [discover.name, discover.official_name].filter(Boolean) as string[];

  for (const dn of displayNames) {
    const name = normalize(dn);
    if (name.length >= 10 && t.includes(name)) {
      return { score: 0.48, reasons: ["Activity title includes the full race name"] };
    }
  }

  const sig = distinctiveTokens(act.name);
  const meaningfulChunk = sig.length >= 2 || t.replace(/\s/g, "").length >= 12;

  for (const dn of displayNames) {
    const name = normalize(dn);
    if (meaningfulChunk && name.includes(t) && t.length >= 8) {
      return { score: 0.44, reasons: ["Activity title is a distinctive substring of the race name"] };
    }
  }

  const primaryDisplay = discover.name;
  if (hasStrongTitleEvidence(act.name, primaryDisplay, { aliasPhrases: aliasList })) {
    return { score: 0.46, reasons: ["Activity title matches the race strongly"] };
  }

  const ta = significantTokens(act.name);
  const tb = significantTokens(
    displayNames.length > 1 ? `${discover.name} ${discover.official_name ?? ""}` : discover.name
  );
  if (ta.length === 0 || tb.length === 0) {
    return { score: 0, reasons: [] };
  }
  const setB = new Set(tb);
  const shared = ta.filter((x) => setB.has(x));
  if (shared.length === 0) {
    return { score: 0, reasons: [] };
  }
  const j = shared.length / Math.max(ta.length, tb.length);
  let s = 0;
  if (j >= 0.45 && shared.length >= 2) {
    s = 0.22;
    reasons.push("Several words overlap the catalog race name");
  } else if (j >= 0.28) {
    s = 0.11;
    reasons.push("Loose overlap with the catalog race name");
  }
  return { score: Math.min(s, 0.32), reasons };
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
  const c = coordProximityScore(discover, activity);
  const e = elevationProfileScore(discover, activity);
  const sp = sportBonus(discover, activity);
  const dt = dateProximityScore(discover, activity.date);
  let score = t.score + d.score + l.score + c.score + e.score + sp + dt.score;
  score = Math.max(0, score);
  score = Math.min(1, score);
  if (t.score < 0.16) {
    const geoDistSeason = d.score + l.score + c.score + dt.score;
    score = Math.min(score, t.score + e.score + sp + geoDistSeason * 0.52);
  }
  const strongTitle = t.score >= 0.4;
  const solidGeo = l.score >= 0.18 || c.score >= 0.1;
  if (!strongTitle && !solidGeo && t.score < 0.18 && t.score > 0) {
    score = Math.min(score, 0.34 + d.score * 0.35 + Math.max(0, dt.score) * 0.25 + c.score * 0.5);
  }
  if (discoverGeographyHardBlock(activity, discover)) {
    score = Math.min(score, 0.38);
  }
  const boost = discover.match_boost ?? 0;
  score = Math.min(1, score + boost);
  const reasons = [...t.reasons, ...d.reasons, ...l.reasons, ...c.reasons, ...e.reasons, ...dt.reasons];
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

export function shouldSkipDiscoverForActivity(discover: DiscoverRace, activity: ActivityMatchInput): boolean {
  if (activity.distance_km >= 50) {
    if (discover.surface === "road" && discover.distance_km < 45) return true;
  }
  return false;
}

/**
 * Minimal activity payload from Strava list JSON for catalog scoring (historical backfill gate).
 */
export function activityMatchInputFromStravaSummary(raw: StravaSummaryActivityJson): ActivityMatchInput {
  const kmRaw = (raw.distance ?? 0) / 1000;
  const km = Math.round(kmRaw * 100) / 100;
  const ll = raw.start_latlng;
  let start_latitude: number | null = null;
  let start_longitude: number | null = null;
  if (Array.isArray(ll) && ll.length >= 2 && Number.isFinite(ll[0]) && Number.isFinite(ll[1])) {
    start_latitude = ll[0] as number;
    start_longitude = ll[1] as number;
  }
  return {
    strava_id: String(raw.id),
    name: raw.name ?? "",
    distance_km: Number.isFinite(km) ? km : 0,
    date: raw.start_date,
    elevation_m: raw.total_elevation_gain ?? null,
    location_city: raw.location_city ?? null,
    location_country: raw.location_country ?? null,
    start_latitude,
    start_longitude,
    sport_type: raw.sport_type ?? null,
    type: raw.type ?? null
  };
}

/** Title + distance + location alignment with catalog — for sub-40km historical import exceptions. */
const STRONG_CATALOG_SCORE_FOR_BACKFILL = 0.58;

export function hasStrongCatalogMatchForStravaSummary(raw: StravaSummaryActivityJson): boolean {
  const activity = activityMatchInputFromStravaSummary(raw);
  if (!Number.isFinite(activity.distance_km) || activity.distance_km < 10) return false;

  let best = 0;
  for (const discover of discoverRaces) {
    if (shouldSkipDiscoverForActivity(discover, activity)) continue;
    const { score } = scoreActivityAgainstDiscover(discover, activity);
    if (score > best) best = score;
    if (best >= STRONG_CATALOG_SCORE_FOR_BACKFILL) return true;
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
