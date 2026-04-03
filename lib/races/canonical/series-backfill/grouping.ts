import { normalizeRaceName } from "@/lib/races/dedupe";

export type CanonRaceEditionRow = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  country: string | null;
  region: string | null;
  start_date: string | null;
  distance_km: number | null;
  series_id: string | null;
  status: string;
};

/** Remove 4-digit years and very short bare numeric tokens (common in titles). */
export function stripYearTokensFromNormalized(normalized: string): string {
  return normalized
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\b\d{4}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizedGeoCity(city: string | null): string {
  return city ? normalizeRaceName(city) : "";
}

export function normalizedGeoCountry(country: string | null): string {
  return country ? normalizeRaceName(country) : "";
}

export function editionNameStem(name: string): string {
  const n = normalizeRaceName(name);
  return stripYearTokensFromNormalized(n);
}

/**
 * Structural key: stem + geo. Aligns with dedupe philosophy (same city/country when present).
 * Empty city+country yields no key — caller skips for auto backfill.
 */
export function makeGroupingKey(name: string, city: string | null, country: string | null): string | null {
  const stem = editionNameStem(name);
  const c = normalizedGeoCity(city);
  const co = normalizedGeoCountry(country);
  if (!co && !c) return null;
  if (!stem) return null;
  return `${stem}\x1f${c}\x1f${co}`;
}

export function startDateYear(startDate: string | null): number | null {
  if (!startDate?.trim()) return null;
  const y = Number(startDate.trim().slice(0, 4));
  return Number.isFinite(y) && y >= 1970 && y <= 2100 ? y : null;
}

/** Stem is non-trivial: avoid grouping on “race”, “10k”, etc. */
export function isStemStrongEnough(stem: string): boolean {
  const parts = stem.split(" ").filter((p) => p.length > 0);
  if (parts.length >= 2) return parts.some((p) => p.length >= 3);
  return stem.length >= 12;
}

const GENERIC_ALIAS_TOKENS = new Set([
  "marathon",
  "half",
  "ultra",
  "trail",
  "road",
  "race",
  "run",
  "running",
  "km",
  "k",
  "mi",
  "miler",
  "10k",
  "5k",
  "21k",
  "42k",
  "50k",
  "100k"
]);

/** True if alias is likely too generic to add automatically. */
export function isRiskyAliasText(aliasText: string, normalized: string): boolean {
  if (normalized.length < 4) return true;
  const tokens = normalized.split(" ").filter((t) => t.length > 0);
  if (tokens.length === 0) return true;
  if (tokens.every((t) => GENERIC_ALIAS_TOKENS.has(t))) return true;
  if (tokens.length === 1 && normalized.length < 10) return true;
  return false;
}

/** Same heuristic as dedupe: at most `maxRatio` relative distance spread. */
export function distancesCoherent(ratiosMax: number, kmValues: (number | null)[]): boolean {
  const nums = kmValues.filter((x): x is number => x != null && Number.isFinite(x) && x > 0);
  if (nums.length <= 1) return true;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const mid = Math.max(min, max);
  if (mid <= 0) return true;
  return (max - min) / mid <= ratiosMax;
}
