import type { Race } from "@/types";

/**
 * True when the race row lives in the database (or demo seed), not a temporary
 * high-confidence Strava merge shown before the user confirms a match.
 */
export function isPersistedPortfolioRace(race: Race): boolean {
  return !race.id.startsWith("strava-virt-");
}

/** Completed majors that count toward profile Top Races / Race Journey (confirmed or manually logged in Runfolio). */
export function persistedCompletedRaces(races: Race[]): Race[] {
  return races.filter((r) => r.is_completed && isPersistedPortfolioRace(r));
}
