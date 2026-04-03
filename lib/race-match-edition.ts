/**
 * Edition-aware matching: each canonical row is treated as a specific dated instance when `startDate` is set.
 * Prepares for future series/editions tables; today we derive edition_year from `start_date` and optional `name` year tokens.
 */

import type { CanonicalRace } from "@/lib/races/canonical/types";

/** Max days between activity and catalog `start_date` for strong-title candidates (same season / edition). */
export const CANONICAL_EDITION_STRONG_TITLE_MAX_DAYS = 120;

/** When name-token search supplements the date window, bind results to this radius around the activity. */
export const CANONICAL_NAME_TOKEN_EDITION_DAY_RADIUS = 520;

/** Beyond this gap, canonical date scoring contributes nothing (wrong edition timing). */
export const CANONICAL_DATE_SCORE_ZERO_BEYOND_DAYS = 40;

const YEAR_IN_TEXT_RE = /\b(20[12]\d)\b/g;

export function daysBetweenYmd(a: string, b: string): number {
  const da = new Date(`${a.slice(0, 10)}T12:00:00Z`).getTime();
  const db = new Date(`${b.slice(0, 10)}T12:00:00Z`).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return 9999;
  return Math.round(Math.abs(da - db) / 86400000);
}

/** Four-digit year if the athlete labeled the activity (e.g. "London Marathon 2024"). */
export function extractLikelyEventYearFromActivityTitle(activityName: string): number | null {
  const matches = activityName.match(YEAR_IN_TEXT_RE);
  if (!matches?.length) return null;
  const years = matches.map((m) => parseInt(m, 10)).filter((y) => y >= 2010 && y <= 2035);
  if (!years.length) return null;
  return years[years.length - 1]!;
}

/** Year embedded in catalog race name (e.g. "Brighton Marathon 2023"). */
export function extractEditionYearFromRaceName(raceName: string): number | null {
  const m = raceName.match(/\b(20[12]\d)\b/);
  if (!m) return null;
  const y = parseInt(m[1]!, 10);
  return y >= 2010 && y <= 2035 ? y : null;
}

export function editionYearFromStartDateYmd(startYmd: string | null | undefined): number | null {
  if (!startYmd || startYmd.length < 4) return null;
  const y = parseInt(startYmd.slice(0, 4), 10);
  return Number.isFinite(y) && y >= 2010 && y <= 2035 ? y : null;
}

/**
 * Activity year in title disagrees with this catalog row's edition (date or name).
 */
export function canonicalTitleYearConflictsEdition(
  activityName: string,
  race: CanonicalRace
): boolean {
  const yTitle = extractLikelyEventYearFromActivityTitle(activityName);
  if (yTitle == null) return false;
  const yStart = editionYearFromStartDateYmd(race.startDate);
  if (yStart != null && yTitle !== yStart) return true;
  const yNamed = extractEditionYearFromRaceName(race.name);
  if (yNamed != null && yTitle !== yNamed) return true;
  return false;
}

/**
 * Hard gate: strong title matches must still sit in a plausible edition window when the row has a date.
 */
export function canonicalStrongTitleFailsEditionWindow(
  activityYmd: string,
  race: CanonicalRace
): boolean {
  const ry = race.startDate?.slice(0, 10);
  if (!ry) return false;
  const days = daysBetweenYmd(activityYmd, ry);
  if (days > CANONICAL_EDITION_STRONG_TITLE_MAX_DAYS) return true;
  return false;
}

/**
 * Calendar years differ by 2+ and the activity is not in the same annual window as the catalog edition → block surfacing.
 */
export function canonicalActivityYearStronglyConflictsEdition(
  activityYmd: string,
  race: CanonicalRace
): boolean {
  const ry = race.startDate?.slice(0, 10);
  if (!ry) return false;
  const yAct = editionYearFromStartDateYmd(activityYmd);
  const yRace = editionYearFromStartDateYmd(ry);
  if (yAct == null || yRace == null) return false;
  if (Math.abs(yAct - yRace) < 2) return false;
  const days = daysBetweenYmd(activityYmd, ry);
  return days > 200;
}
