import { normalizeRaceName } from "@/lib/races/dedupe";
import type { CanonicalRace } from "@/lib/races/canonical/types";
import type { NormalizedRace } from "@/lib/races/types/normalized";

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

function distanceAllowMerge(kmA: number | null, kmB: number | null, maxRatio = 0.12): boolean {
  if (kmA == null || kmB == null) return true;
  const m = Math.max(kmA, kmB);
  if (m <= 0) return true;
  return Math.abs(kmA - kmB) / m <= maxRatio;
}

function locAllowMerge(a: CanonicalRace, n: NormalizedRace): boolean {
  const ca = a.city ? normalizeRaceName(a.city) : "";
  const cn = n.city ? normalizeRaceName(n.city) : "";
  if (ca && cn && ca !== cn) return false;
  const na = a.country ? normalizeRaceName(a.country) : "";
  const nb = n.country ? normalizeRaceName(n.country) : "";
  if (na && nb && na !== nb) return false;
  return true;
}

/**
 * Whether a provider-normalized row likely refers to this canonical race.
 * Conservative: used to suggest attaching a source vs creating a new race.
 */
export function normalizedMatchesCanonical(canonical: CanonicalRace, normalized: NormalizedRace): boolean {
  if (!namesLikelyMatch(canonical.name, normalized.name)) return false;
  if (!datesAllowMerge(canonical.startDate, normalized.startDate)) return false;
  if (!distanceAllowMerge(canonical.distanceKm, normalized.distanceKm)) return false;
  if (!locAllowMerge(canonical, normalized)) return false;
  return true;
}

/** Pick best-scoring candidate from a pre-filtered short list */
export function pickBestCanonicalMatch(
  normalized: NormalizedRace,
  candidates: CanonicalRace[]
): CanonicalRace | null {
  const matches = candidates.filter((c) => normalizedMatchesCanonical(c, normalized));
  if (matches.length === 0) return null;
  matches.sort((a, b) => b.completenessScore - a.completenessScore);
  return matches[0] ?? null;
}
