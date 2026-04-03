import type { Race } from "@/types";
import { getDiscoverRaceDetail, getCatalogDisplayTitle } from "@/lib/discover-race-details";

/**
 * Single display line for portfolio surfaces: prefers catalog title, then stored name,
 * then a neutral label for custom long efforts without a name.
 */
export function getPortfolioRaceLabel(race: Race): string {
  const did = race.discover_race_id?.trim();
  if (did) {
    const detail = getDiscoverRaceDetail(did);
    if (detail?.displayTitle) return detail.displayTitle;
    return getCatalogDisplayTitle(did);
  }
  const n = race.name?.trim();
  if (n) return n;
  if (race.is_completed && (race.distance_km ?? 0) >= 50) return "Unmatched major effort";
  return "Race effort";
}
