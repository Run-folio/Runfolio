/**
 * Candidate generation for canonical (DB) races: shrink the universe before scoring.
 *
 * Treats each row as a dated **edition** when `startDate` is set. Geography blocks first;
 * title passes must still respect edition windows and explicit years in titles.
 */

import type { CanonicalRace } from "@/lib/races/canonical/types";
import { normalizeRaceName } from "@/lib/races/dedupe";
import {
  GENERIC_GEO_TOKENS,
  hasStrongTitleEvidence,
  parseAliasPhrasesFromCategoryTags
} from "@/lib/match-candidate-signals";
import {
  canonicalActivityYearStronglyConflictsEdition,
  canonicalStrongTitleFailsEditionWindow,
  canonicalTitleYearConflictsEdition,
  daysBetweenYmd
} from "@/lib/race-match-edition";
import {
  canonicalGeographyHardBlock,
  minCoordDistanceKmCanonical
} from "@/lib/race-match-geography";
import type { ActivityForCanonicalMatch } from "@/lib/strava-canonical-match/score-activity-canonical";

function distanceRatio(actKm: number, raceKm: number | null): number | null {
  if (raceKm == null || raceKm <= 0 || !Number.isFinite(actKm) || actKm <= 0) return null;
  return Math.abs(actKm - raceKm) / raceKm;
}

/** City match where city token is not a mega-hub singleton weak signal. */
function nonGenericCityAlignment(act: ActivityForCanonicalMatch, race: CanonicalRace): boolean {
  const ac = act.city ? normalizeRaceName(act.city) : "";
  const rc = race.city ? normalizeRaceName(race.city) : "";
  if (!ac || !rc) return false;
  if (ac !== rc) return false;
  return !GENERIC_GEO_TOKENS.has(ac);
}

/**
 * True if this race should enter the scoring pool at all.
 * Geography hard-blocks first, then title/distance gates.
 */
export function isPlausibleCanonicalCandidate(act: ActivityForCanonicalMatch, race: CanonicalRace): boolean {
  if (canonicalGeographyHardBlock(act, race)) return false;

  const aliasPhrases = parseAliasPhrasesFromCategoryTags(race.categoryTags);
  if (hasStrongTitleEvidence(act.name, race.name, { aliasPhrases })) {
    if (canonicalTitleYearConflictsEdition(act.name, race)) return false;
    if (canonicalStrongTitleFailsEditionWindow(act.startDateYmd, race)) return false;
    if (canonicalActivityYearStronglyConflictsEdition(act.startDateYmd, race)) return false;
    return true;
  }

  const ry = race.startDate?.slice(0, 10);
  const dr = distanceRatio(act.distanceKm, race.distanceKm);
  if (dr != null && dr > 0.22) return false;

  if (!ry) {
    const g = minCoordDistanceKmCanonical(act, race);
    if (g != null && g <= 25 && (dr == null || dr <= 0.08)) return true;
    return false;
  }

  const days = daysBetweenYmd(act.startDateYmd, ry);
  if (days > 12) return false;

  const tightDate = days <= 2;
  const closeDist = dr == null || dr <= 0.08;
  if (!tightDate || !closeDist) return false;

  const g = minCoordDistanceKmCanonical(act, race);
  if (g != null && g <= 35) return true;
  if (nonGenericCityAlignment(act, race)) return true;

  return false;
}

export function filterPlausibleCanonicalRaces(
  act: ActivityForCanonicalMatch,
  races: CanonicalRace[]
): CanonicalRace[] {
  return races.filter((r) => isPlausibleCanonicalCandidate(act, r));
}
