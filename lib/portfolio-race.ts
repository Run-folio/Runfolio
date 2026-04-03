import type { Race } from "@/types";

/**
 * True when the race row lives in the database, not a temporary Strava-inference row
 * (`strava-virt-*`) shown before the user confirms a match.
 */
export function isPersistedPortfolioRace(race: Race): boolean {
  return !race.id.startsWith("strava-virt-");
}

/**
 * A finish counts toward portfolio surfaces only if it is completed and tied to catalog or Strava
 * (confirmed match, import, or explicit catalog link — not a bare title-only completion).
 */
export function isConfirmedPortfolioCompletion(race: Race): boolean {
  if (!race.is_completed || !isPersistedPortfolioRace(race)) return false;
  return Boolean(race.discover_race_id?.trim() || race.strava_activity_id?.trim());
}

/** Top Races, Race Journey, dashboard highlights — confirmed completions only; demo/placeholder rows excluded at source. */
export function confirmedCompletedPortfolioRaces(races: Race[]): Race[] {
  return races.filter(isConfirmedPortfolioCompletion);
}

/** Public profile + Top Races / Journey: user-approved portfolio finishes only. */
export function raceIncludedOnProfile(race: Race): boolean {
  return race.include_on_profile !== false;
}

export function profileApprovedCompletedRaces(races: Race[]): Race[] {
  return confirmedCompletedPortfolioRaces(races).filter(raceIncludedOnProfile);
}
