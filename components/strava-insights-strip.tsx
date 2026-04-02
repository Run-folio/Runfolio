import type { StravaFeedStats } from "@/types";
import { formatDurationFromSeconds } from "@/lib/strava-api";

type Props = {
  stats: StravaFeedStats;
};

export function StravaInsightsStrip({ stats }: Props) {
  if (stats.activityCount === 0) return null;
  return (
    <div className="grid gap-4 border border-border bg-panel/50 p-5 md:grid-cols-2 lg:grid-cols-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Activities (loaded)</p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-white">{stats.activityCount}</p>
        <p className="type-meta mt-1 text-[11px]">{stats.runCount} run-like</p>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Total distance</p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-white">{stats.totalDistanceKm} km</p>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Total elevation</p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-white">{stats.totalElevationM} m</p>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Moving time</p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-white">{formatDurationFromSeconds(stats.totalMovingTimeSec)}</p>
        <p className="type-meta mt-1 text-[11px]">
          Longest {stats.longestActivityKm} km · Peak elev {stats.highestElevationM} m
        </p>
      </div>
    </div>
  );
}
