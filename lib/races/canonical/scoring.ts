import type { CanonicalRace } from "@/lib/races/canonical/types";

export type QualityFlags = {
  missingName: boolean;
  missingDate: boolean;
  missingLocation: boolean;
  missingDistance: boolean;
  missingOfficialUrl: boolean;
  missingLogo: boolean;
  missingCoordinates: boolean;
  missingDescription: boolean;
};

const WEIGHTS = {
  name: 15,
  date: 15,
  location: 15,
  distance: 12,
  officialUrl: 10,
  logo: 8,
  coords: 8,
  description: 7,
  registrationUrl: 5,
  elevation: 5
};

function hasLocation(r: Pick<CanonicalRace, "city" | "country" | "region">): boolean {
  return Boolean(r.city?.trim() || r.country?.trim() || r.region?.trim());
}

/**
 * 0–100: fraction of weighted fields populated.
 */
export function computeCompletenessScore(r: CanonicalRace): number {
  let earned = 0;
  let max = 0;
  const add = (w: number, ok: boolean) => {
    max += w;
    if (ok) earned += w;
  };
  add(WEIGHTS.name, Boolean(r.name?.trim()));
  add(WEIGHTS.date, Boolean(r.startDate?.trim()));
  add(WEIGHTS.location, hasLocation(r));
  add(WEIGHTS.distance, r.distanceKm != null && r.distanceKm > 0);
  add(WEIGHTS.officialUrl, Boolean(r.officialUrl?.trim()));
  add(WEIGHTS.logo, Boolean(r.logoUrl?.trim() || r.heroImageUrl?.trim()));
  add(WEIGHTS.coords, r.latitude != null && r.longitude != null);
  add(WEIGHTS.description, Boolean(r.description?.trim() && r.description.length > 20));
  add(WEIGHTS.registrationUrl, Boolean(r.registrationUrl?.trim()));
  add(WEIGHTS.elevation, r.elevationGainM != null && r.elevationGainM > 0);
  return max === 0 ? 0 : Math.round((earned / max) * 100);
}

/**
 * 0–100: readiness for product surfaces (penalize missing “critical” fields).
 */
export function computeQualityScore(r: CanonicalRace, flags: QualityFlags): number {
  const base = computeCompletenessScore(r);
  let penalty = 0;
  if (flags.missingName) penalty += 40;
  if (flags.missingDate) penalty += 15;
  if (flags.missingLocation) penalty += 15;
  if (flags.missingDistance) penalty += 10;
  return Math.max(0, Math.min(100, base - penalty));
}

export function computeQualityFlags(r: CanonicalRace): QualityFlags {
  return {
    missingName: !r.name?.trim(),
    missingDate: !r.startDate?.trim(),
    missingLocation: !hasLocation(r),
    missingDistance: r.distanceKm == null || r.distanceKm <= 0,
    missingOfficialUrl: !r.officialUrl?.trim(),
    missingLogo: !r.logoUrl?.trim() && !r.heroImageUrl?.trim(),
    missingCoordinates: r.latitude == null || r.longitude == null,
    missingDescription: !r.description?.trim() || r.description.length < 20
  };
}

export function recomputeCanonicalScores(race: CanonicalRace): CanonicalRace {
  const flags = computeQualityFlags(race);
  const completenessScore = computeCompletenessScore(race);
  const qualityScore = computeQualityScore(race, flags);
  const qualityFlags: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(flags)) {
    if (v) qualityFlags[k] = true;
  }
  return {
    ...race,
    completenessScore,
    qualityScore,
    qualityFlags
  };
}

/** Minimum bar for default search surfacing (tune per product). */
export const MIN_ACTIVE_SEARCH_COMPLETENESS = 35;
