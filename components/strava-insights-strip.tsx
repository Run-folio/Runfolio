import type { StravaFeedStats } from "@/types";
import { formatDurationFromSeconds } from "@/lib/strava-api";

type Props = {
  stats: StravaFeedStats;
  /** When set, labels emphasize the filtered race-candidate feed. */
  context?: "all" | "race_candidates";
};

export function StravaInsightsStrip({ stats, context = "all" }: Props) {
  if (stats.activityCount === 0) return null;
  const isRace = context === "race_candidates";
  return (
    <div className="grid grid-cols-2 gap-3 border border-border bg-panel/50 p-4 md:gap-4 md:p-5 lg:grid-cols-4">
      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted md:text-[10px] md:tracking-[0.2em]">
          {isRace ? "Candidates" : "Activities"}
        </p>
        <p className="mt-1.5 text-xl font-bold tabular-nums text-white md:mt-2 md:text-2xl">{stats.activityCount}</p>
        <p className="type-meta mt-0.5 line-clamp-2 text-[10px] md:mt-1 md:text-[11px]">
          {isRace ? "Run types" : `${stats.runCount} run-like`}
        </p>
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted md:text-[10px] md:tracking-[0.2em]">Distance</p>
        <p className="mt-1.5 truncate text-xl font-bold tabular-nums text-white md:mt-2 md:text-2xl">
          {stats.totalDistanceKm} km
        </p>
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted md:text-[10px] md:tracking-[0.2em]">Elevation</p>
        <p className="mt-1.5 text-xl font-bold tabular-nums text-white md:mt-2 md:text-2xl">{stats.totalElevationM} m</p>
      </div>
      <div className="min-w-0 sm:col-span-2 lg:col-span-1">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted md:text-[10px] md:tracking-[0.2em]">Moving time</p>
        <p className="mt-1.5 truncate text-xl font-bold tabular-nums text-white md:mt-2 md:text-2xl">
          {formatDurationFromSeconds(stats.totalMovingTimeSec)}
        </p>
        <p className="type-meta mt-0.5 line-clamp-2 text-[10px] md:mt-1 md:text-[11px]">
          Longest {stats.longestActivityKm} km · Peak {stats.highestElevationM} m
        </p>
      </div>
    </div>
  );
}
