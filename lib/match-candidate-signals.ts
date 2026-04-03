/**
 * Shared token + title-strength helpers for race matching (canonical + discover catalogs).
 * Keeps generic geography and run filler words from acting as strong identifying signals alone.
 */

import { normalizeRaceName } from "@/lib/races/dedupe";

/** City / region tokens that are too common to imply a specific event (single-token weakness). */
export const GENERIC_GEO_TOKENS = new Set([
  "london",
  "paris",
  "boston",
  "chicago",
  "berlin",
  "dublin",
  "nyc",
  "york",
  "francisco",
  "angeles",
  "tokyo",
  "sydney",
  "toronto",
  "vancouver",
  "manchester",
  "birmingham",
  "liverpool",
  "edinburgh",
  "glasgow",
  "brighton",
  "cambridge",
  "oxford",
  "seattle",
  "denver",
  "atlanta",
  "houston",
  "dallas",
  "miami",
  "phoenix",
  "portland",
  "philadelphia",
  "washington",
  "melbourne",
  "auckland",
  "amsterdam",
  "barcelona",
  "madrid",
  "rome",
  "vienna",
  "munich",
  "copenhagen",
  "stockholm",
  "oslo",
  "uk",
  "usa",
  "uae"
]);

/** Tokens that rarely identify a specific commercial race. */
/** Distance / format words shared by many unrelated events — never sufficient alone for a “strong” title match. */
export const EVENT_FORMAT_TOKENS = new Set([
  "marathon",
  "half",
  "marathons",
  "ultra",
  "ultras",
  "trail",
  "miler",
  "10k",
  "5k",
  "21k",
  "42k",
  "50k",
  "100k",
  "relay",
  "parkrun"
]);

export const RUN_TITLE_STOPWORDS = new Set([
  "run",
  "running",
  "jog",
  "jogging",
  "easy",
  "morning",
  "afternoon",
  "evening",
  "lunch",
  "commute",
  "recovery",
  "workout",
  "wrun",
  "tempo",
  "long",
  "slow",
  "fast",
  "race",
  "day",
  "with",
  "the",
  "and",
  "afternoon"
]);

export function significantTokensFromNormalized(normalizedWords: string): string[] {
  return normalizedWords
    .split(" ")
    .filter((w) => w.length > 2 && !GENERIC_GEO_TOKENS.has(w) && !RUN_TITLE_STOPWORDS.has(w));
}

export function significantTokens(name: string): string[] {
  return significantTokensFromNormalized(normalizeRaceName(name));
}

/** Tokens that can participate in “strong” identity overlap (excludes format words like “marathon” alone). */
export function distinctiveTokens(name: string): string[] {
  return significantTokens(name).filter((w) => !EVENT_FORMAT_TOKENS.has(w));
}

/** Normalized activity text contains normalized race name (real event spelled out in title). */
export function activityEmbedsRaceName(activityName: string, raceName: string, minRaceNormLen = 10): boolean {
  const a = normalizeRaceName(activityName);
  const r = normalizeRaceName(raceName);
  return r.length >= minRaceNormLen && a.includes(r);
}

/** Activity title appears as a contiguous substring of the official race name (shorter Strava titles vs long catalog names). */
export function raceNameContainsActivityTitle(activityName: string, raceName: string, minActivityNormLen = 12): boolean {
  const a = normalizeRaceName(activityName);
  const r = normalizeRaceName(raceName);
  return a.length >= minActivityNormLen && r.includes(a);
}

/** Curated aliases from `categoryTags` entries like `alias:TCS London Marathon`. */
export function parseAliasPhrasesFromCategoryTags(tags: string[] | null | undefined): string[] {
  if (!tags?.length) return [];
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.trim();
    if (!t.toLowerCase().startsWith("alias:")) continue;
    const p = t.slice(6).trim();
    if (p.length >= 4) out.push(p);
  }
  return out;
}

/**
 * Strong title evidence: full embedded name, known alias phrase in activity, or solid overlap on non-generic tokens.
 */
export function hasStrongTitleEvidence(
  activityName: string,
  raceName: string,
  opts?: { aliasPhrases?: string[] }
): boolean {
  if (activityEmbedsRaceName(activityName, raceName, 10)) return true;
  if (raceNameContainsActivityTitle(activityName, raceName, 12)) return true;

  const aNorm = normalizeRaceName(activityName);
  for (const phrase of opts?.aliasPhrases ?? []) {
    const p = normalizeRaceName(phrase);
    if (p.length >= 6 && aNorm.includes(p)) return true;
  }

  const ta = distinctiveTokens(activityName);
  const tr = distinctiveTokens(raceName);
  if (ta.length === 0 || tr.length === 0) return false;

  const setR = new Set(tr);
  const shared = ta.filter((t) => setR.has(t));
  if (shared.length === 0) return false;

  const jaccard = shared.length / Math.max(ta.length, tr.length);
  if (shared.length >= 2 && jaccard >= 0.35) return true;

  return false;
}
