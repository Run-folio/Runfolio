/**
 * First-class geography for race matching: normalize countries, compare activity vs catalog,
 * and classify hard conflicts (e.g. UK activity vs South Africa event).
 */

import { normalizeRaceName } from "@/lib/races/dedupe";
import type { CanonicalRace } from "@/lib/races/canonical/types";
import type { DiscoverRace } from "@/lib/discover-race-schema";
import type { ActivityMatchInput } from "@/types";

/** Minimal activity geography — kept local to avoid importing the canonical scorer (circular). */
export type ActivityGeoForRaceMatch = {
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
};

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
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

/** Collapse vernacular country / territory strings to a stable comparison token. */
const COUNTRY_ALIASES: Record<string, string> = {
  uk: "gb",
  gb: "gb",
  "united kingdom": "gb",
  "great britain": "gb",
  england: "gb",
  scotland: "gb",
  wales: "gb",
  britain: "gb",
  "northern ireland": "gb",
  "isle of man": "gb",
  us: "us",
  usa: "us",
  "united states": "us",
  "united states of america": "us",
  uae: "ae",
  "united arab emirates": "ae",
  za: "za",
  "south africa": "za",
  rsa: "za",
  ma: "ma",
  morocco: "ma",
  au: "au",
  australia: "au",
  nz: "nz",
  "new zealand": "nz",
  ie: "ie",
  ireland: "ie",
  "republic of ireland": "ie",
  fr: "fr",
  france: "fr",
  de: "de",
  germany: "de",
  deutschland: "de",
  es: "es",
  spain: "es",
  it: "it",
  italy: "it",
  nl: "nl",
  netherlands: "nl",
  holland: "nl",
  be: "be",
  belgium: "be",
  pt: "pt",
  portugal: "pt",
  ch: "ch",
  switzerland: "ch",
  at: "at",
  austria: "at",
  pl: "pl",
  poland: "pl",
  se: "se",
  sweden: "se",
  no: "no",
  norway: "no",
  fi: "fi",
  finland: "fi",
  dk: "dk",
  denmark: "dk",
  jp: "jp",
  japan: "jp",
  cn: "cn",
  china: "cn",
  hk: "hk",
  "hong kong": "hk",
  sg: "sg",
  singapore: "sg",
  ca: "ca",
  canada: "ca",
  mx: "mx",
  mexico: "mx",
  br: "br",
  brazil: "br",
  ar: "ar",
  argentina: "ar",
  cl: "cl",
  chile: "cl",
  in: "in",
  india: "in"
};

export function normalizeCountryKey(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const k = normalizeRaceName(raw).trim();
  if (!k) return null;
  return COUNTRY_ALIASES[k] ?? k;
}

/**
 * Both sides have a country label and they resolve to different keys.
 * `null` means inconclusive (missing/weak data — do not hard-block on this alone).
 */
export function countriesClearlyMismatch(a: string | null | undefined, b: string | null | undefined): boolean | null {
  const ka = normalizeCountryKey(a);
  const kb = normalizeCountryKey(b);
  if (!ka || !kb) return null;
  return ka !== kb;
}

export function minCoordDistanceKmCanonical(act: ActivityGeoForRaceMatch, race: CanonicalRace): number | null {
  if (act.latitude == null || act.longitude == null || race.latitude == null || race.longitude == null) {
    return null;
  }
  return haversineKm(act.latitude, act.longitude, race.latitude, race.longitude);
}

/** ~continental / intercontinental — activity almost certainly not at this start. */
export const COORD_BLOCK_DISTANCE_KM = 2200;

/** Beyond this, treat as no location match for scoring (unless only text fallback). */
export const COORD_FAR_PENALTY_KM = 900;

export function canonicalCoordsHardBlock(act: ActivityGeoForRaceMatch, race: CanonicalRace): boolean {
  const km = minCoordDistanceKmCanonical(act, race);
  if (km == null) return false;
  return km >= COORD_BLOCK_DISTANCE_KM;
}

/** Hard block as automatic candidate when country labels conflict or coordinates are continents apart. */
export function canonicalGeographyHardBlock(act: ActivityGeoForRaceMatch, race: CanonicalRace): boolean {
  const c = countriesClearlyMismatch(act.country, race.country);
  if (c === true) return true;
  return canonicalCoordsHardBlock(act, race);
}

/**
 * Candidate generation: geography is inconclusive only when we lack both useful coords and both countries.
 * (City-only is handled elsewhere; we do not block on missing Strava country if GPS agrees.)
 */
export function hasUsableCanonicalGeo(act: ActivityGeoForRaceMatch): boolean {
  const hasCoords = act.latitude != null && act.longitude != null;
  const hasCountry = Boolean(act.country?.trim());
  return hasCoords || hasCountry;
}

function inferCountryFromDiscoverLocation(location: string): string | null {
  const parts = location
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const tail = parts[parts.length - 1]!;
  if (tail.length < 3) return null;
  return tail;
}

function discoverCatalogCountry(discover: DiscoverRace): string | null {
  if (discover.country?.trim()) return discover.country.trim();
  return inferCountryFromDiscoverLocation(discover.location);
}

/** When both activity and catalog have coordinates, block implausible intercontinental matches. */
export function discoverCoordsHardBlock(act: ActivityMatchInput, discover: DiscoverRace): boolean {
  if (
    act.start_latitude == null ||
    act.start_longitude == null ||
    discover.latitude == null ||
    discover.longitude == null
  ) {
    return false;
  }
  const km = haversineKm(act.start_latitude, act.start_longitude, discover.latitude, discover.longitude);
  return km >= COORD_BLOCK_DISTANCE_KM;
}

/**
 * Discover catalog: compare Strava country to structured `country` or trailing segment of `location`.
 */
export function discoverGeographyHardBlock(act: ActivityMatchInput, discover: DiscoverRace): boolean {
  const catCountry = discoverCatalogCountry(discover);
  if (act.location_country?.trim() && catCountry) {
    const mismatch = countriesClearlyMismatch(act.location_country, catCountry);
    if (mismatch === true) return true;
  }
  return discoverCoordsHardBlock(act, discover);
}
