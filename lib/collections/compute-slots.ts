import { raceIsBucketListFutureGoal } from "@/lib/bucket-list-model";
import { formatDiscoverDistance } from "@/lib/discover-races";
import { getDiscoverRaceDetail } from "@/lib/discover-race-details";
import { getRaceLogoPath } from "@/lib/race-logos";
import type { Race } from "@/types";

export type TrophySlotComputed = {
  discoverId: string;
  displayTitle: string;
  location: string;
  distanceLabel: string;
  categoryLabel: string;
  heroImagePath: string;
  logoPath: string;
  /** Logged-in: durable DB row with this discover id + completed. */
  completedRace: Race | null;
  /** Logged-in: future bucket goal for this discover id. */
  bucketRace: Race | null;
};

function pickCompletedForDiscover(races: Race[], discoverId: string): Race | null {
  const candidates = races.filter(
    (r) => r.discover_race_id === discoverId && r.is_completed === true
  );
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))[0] ?? null;
}

function pickBucketFutureForDiscover(races: Race[], discoverId: string): Race | null {
  return (
    races.find(
      (r) =>
        r.discover_race_id === discoverId &&
        !r.is_completed &&
        raceIsBucketListFutureGoal(r)
    ) ?? null
  );
}

export function computeTrophySlots(userRaces: Race[], discoverIds: string[]): TrophySlotComputed[] {
  return discoverIds.map((discoverId) => {
    const detail = getDiscoverRaceDetail(discoverId);
    const catalog = detail;
    const displayTitle = catalog?.displayTitle ?? discoverId;
    const location = catalog?.location ?? "—";
    const distanceLabel = catalog
      ? formatDiscoverDistance(catalog.distanceKm, catalog.multiDay)
      : "—";
    const categoryLabel = catalog?.categoryLabel ?? "Race";
    const heroImagePath = catalog?.heroImagePath ?? "/reference/hero-1.png";
    const logoPath = getRaceLogoPath(catalog?.name ?? displayTitle);

    return {
      discoverId,
      displayTitle,
      location,
      distanceLabel,
      categoryLabel,
      heroImagePath,
      logoPath,
      completedRace: pickCompletedForDiscover(userRaces, discoverId),
      bucketRace: pickBucketFutureForDiscover(userRaces, discoverId)
    };
  });
}

export function collectionProgress(slots: TrophySlotComputed[]): {
  completed: number;
  total: number;
  bucketed: number;
} {
  const total = slots.length;
  const completed = slots.filter((s) => s.completedRace).length;
  const bucketed = slots.filter((s) => !s.completedRace && s.bucketRace).length;
  return { completed, total, bucketed };
}
