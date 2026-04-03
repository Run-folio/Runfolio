import { recomputeCanonicalScores } from "@/lib/races/canonical/scoring";
import type { CanonicalRace } from "@/lib/races/canonical/types";
import type { NormalizedRace } from "@/lib/races/types/normalized";

function longerString(a: string | null, b: string | null): string | null {
  if (!a?.trim()) return b ?? null;
  if (!b?.trim()) return a ?? null;
  return a.length >= b.length ? a : b;
}

function preferUrl(current: string | null, incoming: string | null, incomingTrust: number, currentTrust: number): string | null {
  if (!incoming?.trim()) return current;
  if (!current?.trim()) return incoming;
  if (incomingTrust !== currentTrust) {
    return incomingTrust > currentTrust ? incoming : current;
  }
  const incHttps = incoming.startsWith("https:");
  const curHttps = current.startsWith("https:");
  if (incHttps && !curHttps) return incoming;
  if (!incHttps && curHttps) return current;
  return incoming.length >= current.length ? incoming : current;
}

function pickNumber(cur: number | null, inc: number | null, incTrust: number, curTrust: number): number | null {
  if (inc == null || Number.isNaN(inc)) return cur;
  if (cur == null || Number.isNaN(cur)) return inc;
  return incTrust >= curTrust ? inc : cur;
}

function pickBool(cur: boolean | null, inc: boolean | null, incTrust: number, curTrust: number): boolean | null {
  if (inc == null) return cur;
  if (cur == null) return inc;
  return incTrust >= curTrust ? inc : cur;
}

function isLocked(locks: Record<string, boolean>, field: string): boolean {
  return locks[field] === true;
}

export type MergeProvenance = {
  incomingSource: NormalizedRace["source"];
  incomingTrust: number;
  existingTrustHint: number;
};

/**
 * Field-level merge: never prefer empty over non-empty; richer strings win;
 * trust breaks ties on URLs and numeric fields. Respects `curationLocked`.
 */
export function mergeCanonicalFromNormalized(
  current: CanonicalRace,
  incoming: NormalizedRace,
  prov: MergeProvenance
): CanonicalRace {
  const locks = current.curationLocked;
  const { incomingTrust } = prov;
  const curT = prov.existingTrustHint;

  const next: CanonicalRace = {
    ...current,
    seriesId: isLocked(locks, "seriesId")
      ? current.seriesId
      : incoming.canonicalSeriesId?.trim()
        ? incoming.canonicalSeriesId.trim()
        : current.seriesId,
    name: isLocked(locks, "name")
      ? current.name
      : longerString(current.name, incoming.name)?.trim() || current.name,
    description: isLocked(locks, "description")
      ? current.description
      : longerString(current.description, incoming.description),
    organizerName: isLocked(locks, "organizerName")
      ? current.organizerName
      : longerString(current.organizerName, incoming.organizerName),
    officialUrl: isLocked(locks, "officialUrl")
      ? current.officialUrl
      : preferUrl(current.officialUrl, incoming.officialUrl, incomingTrust, curT),
    registrationUrl: isLocked(locks, "registrationUrl")
      ? current.registrationUrl
      : preferUrl(current.registrationUrl, incoming.registrationUrl, incomingTrust, curT),
    logoUrl: isLocked(locks, "logoUrl")
      ? current.logoUrl
      : incoming.logoUrl?.trim()
        ? incoming.logoUrl
        : current.logoUrl,
    heroImageUrl: isLocked(locks, "heroImageUrl")
      ? current.heroImageUrl
      : incoming.heroImageUrl?.trim()
        ? incoming.heroImageUrl
        : current.heroImageUrl,
    country: isLocked(locks, "country")
      ? current.country
      : incoming.country?.trim()
        ? incoming.country
        : current.country,
    region: isLocked(locks, "region")
      ? current.region
      : incoming.region?.trim()
        ? incoming.region
        : current.region,
    city: isLocked(locks, "city")
      ? current.city
      : incoming.city?.trim()
        ? incoming.city
        : current.city,
    venue: isLocked(locks, "venue") ? current.venue : longerString(current.venue, incoming.venue),
    latitude: isLocked(locks, "latitude")
      ? current.latitude
      : pickNumber(current.latitude, incoming.latitude, incomingTrust, curT),
    longitude: isLocked(locks, "longitude")
      ? current.longitude
      : pickNumber(current.longitude, incoming.longitude, incomingTrust, curT),
    startDate: isLocked(locks, "startDate")
      ? current.startDate
      : incoming.startDate?.trim()
        ? incoming.startDate
        : current.startDate,
    endDate: isLocked(locks, "endDate")
      ? current.endDate
      : incoming.endDate?.trim()
        ? incoming.endDate
        : current.endDate,
    timezone: isLocked(locks, "timezone")
      ? current.timezone
      : incoming.timezone?.trim()
        ? incoming.timezone
        : current.timezone,
    distanceKm: isLocked(locks, "distanceKm")
      ? current.distanceKm
      : pickNumber(current.distanceKm, incoming.distanceKm, incomingTrust, curT),
    elevationGainM: isLocked(locks, "elevationGainM")
      ? current.elevationGainM
      : pickNumber(current.elevationGainM, incoming.elevationGainM, incomingTrust, curT),
    raceType: isLocked(locks, "raceType")
      ? current.raceType
      : longerString(current.raceType, incoming.raceType),
    surfaceType: isLocked(locks, "surfaceType")
      ? current.surfaceType
      : longerString(current.surfaceType, incoming.surfaceType),
    categoryTags: isLocked(locks, "categoryTags")
      ? current.categoryTags
      : [...new Set([...current.categoryTags, ...incoming.categoryTags])].slice(0, 48),
    difficultyScore: isLocked(locks, "difficultyScore")
      ? current.difficultyScore
      : pickNumber(current.difficultyScore, incoming.difficultyScore, incomingTrust, curT),
    utmbIndexEligible: isLocked(locks, "utmbIndexEligible")
      ? current.utmbIndexEligible
      : pickBool(current.utmbIndexEligible, incoming.utmbIndexEligible, incomingTrust, curT),
    utmbCategory: isLocked(locks, "utmbCategory")
      ? current.utmbCategory
      : longerString(current.utmbCategory, incoming.utmbCategory),
    isTrail: isLocked(locks, "isTrail")
      ? current.isTrail
      : pickBool(current.isTrail, incoming.isTrail, incomingTrust, curT),
    isRoad: isLocked(locks, "isRoad")
      ? current.isRoad
      : pickBool(current.isRoad, incoming.isRoad, incomingTrust, curT),
    isUltra: isLocked(locks, "isUltra")
      ? current.isUltra
      : pickBool(current.isUltra, incoming.isUltra, incomingTrust, curT)
  };

  return recomputeCanonicalScores(next);
}

/** Create initial canonical row from first normalized payload (draft / needs_review caller decides status). */
export function canonicalFromNormalizedSeed(
  incoming: NormalizedRace,
  slug: string,
  id: string,
  now: string
): CanonicalRace {
  const base: CanonicalRace = {
    id,
    slug,
    seriesId: incoming.canonicalSeriesId?.trim() ?? null,
    name: incoming.name,
    description: incoming.description,
    organizerName: incoming.organizerName,
    officialUrl: incoming.officialUrl,
    registrationUrl: incoming.registrationUrl,
    logoUrl: incoming.logoUrl,
    heroImageUrl: incoming.heroImageUrl,
    country: incoming.country,
    region: incoming.region,
    city: incoming.city,
    venue: incoming.venue,
    latitude: incoming.latitude,
    longitude: incoming.longitude,
    startDate: incoming.startDate,
    endDate: incoming.endDate,
    timezone: incoming.timezone,
    distanceKm: incoming.distanceKm,
    elevationGainM: incoming.elevationGainM,
    raceType: incoming.raceType,
    surfaceType: incoming.surfaceType,
    categoryTags: [...incoming.categoryTags],
    difficultyScore: incoming.difficultyScore,
    utmbIndexEligible: incoming.utmbIndexEligible,
    utmbCategory: incoming.utmbCategory,
    isTrail: incoming.isTrail,
    isRoad: incoming.isRoad,
    isUltra: incoming.isUltra,
    qualityScore: 0,
    completenessScore: 0,
    qualityFlags: {},
    status: "draft",
    curationLocked: {},
    createdAt: now,
    updatedAt: now
  };
  return recomputeCanonicalScores(base);
}
