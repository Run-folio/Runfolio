import type { Race } from "@/types";

/** Legacy / unset rows count as bucket-list-backed (backward compatible). */
export function raceIsBucketListItem(race: Race): boolean {
  return race.is_bucket_list_item !== false;
}

/** Completed races shown in the Bucket List “Completed” UI — not Strava-only portfolio rows. */
export function raceCountsAsBucketListCompleted(race: Race): boolean {
  return Boolean(race.is_completed && raceIsBucketListItem(race));
}

/** Incomplete rows the user added as future bucket goals (excludes malformed false+incomplete). */
export function raceIsBucketListFutureGoal(race: Race): boolean {
  return !race.is_completed && raceIsBucketListItem(race);
}
