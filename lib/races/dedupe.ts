import { mergeNormalizedRaces, providerPriority } from "@/lib/races/enrichment";
import type { NormalizedRace } from "@/lib/races/types/normalized";

export function normalizeRaceName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function namesLikelyMatch(a: string, b: string): boolean {
  const na = normalizeRaceName(a);
  const nb = normalizeRaceName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length < 5 || nb.length < 5) return na === nb;
  return na.includes(nb) || nb.includes(na);
}

function datesAllowMerge(da: string | null, db: string | null): boolean {
  if (!da || !db) return true;
  return da.slice(0, 10) === db.slice(0, 10);
}

function distanceAllowMerge(kmA: number | null, kmB: number | null, maxRatio = 0.1): boolean {
  if (kmA == null || kmB == null) return true;
  const m = Math.max(kmA, kmB);
  if (m <= 0) return true;
  return Math.abs(kmA - kmB) / m <= maxRatio;
}

function locAllowMerge(a: NormalizedRace, b: NormalizedRace): boolean {
  const ca = a.city ? normalizeRaceName(a.city) : "";
  const cb = b.city ? normalizeRaceName(b.city) : "";
  if (ca && cb && ca !== cb) return false;
  const na = a.country ? normalizeRaceName(a.country) : "";
  const nb = b.country ? normalizeRaceName(b.country) : "";
  if (na && nb && na !== nb) return false;
  return true;
}

/** Heuristic: same event across providers */
export function areLikelyDuplicateRaces(a: NormalizedRace, b: NormalizedRace): boolean {
  if (a.id === b.id) return true;
  if (!namesLikelyMatch(a.name, b.name)) return false;
  if (!datesAllowMerge(a.startDate, b.startDate)) return false;
  if (!distanceAllowMerge(a.distanceKm, b.distanceKm)) return false;
  if (!locAllowMerge(a, b)) return false;
  return true;
}

/**
 * Collapse duplicates by merging richer provider data. Input should be sorted by priority if you want deterministic picks;
 * this function sorts a working copy by provider priority (desc) before folding.
 */
export function dedupeNormalizedRaces(races: NormalizedRace[]): NormalizedRace[] {
  const sorted = [...races].sort((x, y) => providerPriority(y.source) - providerPriority(x.source));
  const out: NormalizedRace[] = [];

  for (const race of sorted) {
    const idx = out.findIndex((existing) => areLikelyDuplicateRaces(existing, race));
    if (idx === -1) {
      out.push(race);
    } else {
      out[idx] = mergeNormalizedRaces(out[idx]!, race);
    }
  }

  return out;
}
