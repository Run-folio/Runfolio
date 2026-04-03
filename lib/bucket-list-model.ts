import type { Race } from "@/types";
import { isConfirmedPortfolioCompletion } from "@/lib/portfolio-race";

/** Legacy / unset rows count as bucket-list-backed (backward compatible). */
export function raceIsBucketListItem(race: Race): boolean {
  return race.is_bucket_list_item !== false;
}

/**
 * Bucket list “completed” = user had this race as a bucket item and has a confirmed finish
 * (catalog or Strava link), not a bare title-only row.
 */
export function raceCountsAsBucketListCompleted(race: Race): boolean {
  return isConfirmedPortfolioCompletion(race) && raceIsBucketListItem(race);
}

/** Incomplete rows the user added as future bucket goals (excludes malformed false+incomplete). */
export function raceIsBucketListFutureGoal(race: Race): boolean {
  return !race.is_completed && raceIsBucketListItem(race);
}
