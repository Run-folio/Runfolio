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

/** Legacy flag: excluded when false (hidden). */
export function raceIncludedOnProfile(race: Race): boolean {
  return race.include_on_profile !== false;
}

/** Shown on the curated public profile (confirmed finish + not hidden + published). */
export function racePublishedOnProfile(race: Race): boolean {
  if (!raceIncludedOnProfile(race)) return false;
  return Boolean(race.profile_approved_at?.trim());
}

/** Completed + linked rows the user can publish (Strava or catalog id). */
export function raceEligibleForProfilePublish(race: Race): boolean {
  return isConfirmedPortfolioCompletion(race) && !race.profile_approved_at?.trim();
}

/** User hid a previously published finish — can restore visibility. */
export function raceNeedsProfileRestore(race: Race): boolean {
  return (
    isConfirmedPortfolioCompletion(race) &&
    race.include_on_profile === false &&
    Boolean(race.profile_approved_at?.trim())
  );
}

export function profileApprovedCompletedRaces(races: Race[]): Race[] {
  return confirmedCompletedPortfolioRaces(races).filter(racePublishedOnProfile);
}
