import { raceIsBucketListFutureGoal } from "@/lib/bucket-list-model";
import { confirmedCompletedPortfolioRaces } from "@/lib/portfolio-race";
import type { Race } from "@/types";

export type CatalogDiscoverViewerState =
  | { kind: "guest" }
  | {
      kind: "authed";
      status: "none" | "bucket" | "completed";
      /** Future bucket row id when status is `bucket` */
      bucketRaceId?: string;
      /** Best confirmed completion row for this discover id */
      completedRaceId?: string;
    };

export function catalogDiscoverViewerState(
  viewer: "guest" | "authed",
  races: Race[] | null,
  discoverId: string
): CatalogDiscoverViewerState {
  if (viewer === "guest") return { kind: "guest" };
  return catalogDiscoverStateForUser(races, discoverId);
}

/**
 * Per catalog `discover_race_id`, derive list/detail card state from the user’s `races` rows.
 */
export function catalogDiscoverStateForUser(races: Race[] | null, discoverId: string): CatalogDiscoverViewerState {
  if (!races?.length) {
    return { kind: "authed", status: "none" };
  }
  const rows = races.filter((r) => r.discover_race_id === discoverId);
  if (rows.length === 0) {
    return { kind: "authed", status: "none" };
  }
  const confirmed = confirmedCompletedPortfolioRaces(rows);
  const bestCompleted =
    [...confirmed].sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))[0] ?? null;
  const bucketFuture = rows.find((r) => !r.is_completed && raceIsBucketListFutureGoal(r)) ?? null;
  if (bestCompleted) {
    return {
      kind: "authed",
      status: "completed",
      completedRaceId: bestCompleted.id,
      ...(bucketFuture ? { bucketRaceId: bucketFuture.id } : {})
    };
  }
  if (bucketFuture) {
    return { kind: "authed", status: "bucket", bucketRaceId: bucketFuture.id };
  }
  return { kind: "authed", status: "none" };
}

export function usedStravaActivityIdsFromRaces(races: Race[] | null): Set<string> {
  const s = new Set<string>();
  if (!races) return s;
  for (const r of races) {
    const id = r.strava_activity_id?.trim();
    if (id) s.add(id);
  }
  return s;
}
