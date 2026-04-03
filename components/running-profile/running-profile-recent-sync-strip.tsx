import type { StravaSyncedActivityRow } from "@/lib/strava-sync/types";
import { SyncedActivityProfileToggle } from "@/components/running-profile/synced-activity-profile-toggle";

type Props = {
  rows: StravaSyncedActivityRow[];
};

/** Owner-only: pin representative efforts without leaving the profile. */
export function RunningProfileRecentSyncStrip({ rows }: Props) {
  if (rows.length === 0) return null;

  return (
    <div className="border-t border-white/10 bg-black/20 px-4 py-4">
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/40">Recent sync — tap to pin</p>
      <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {rows.map((row) => (
          <li
            key={row.strava_activity_id}
            className="min-w-[200px] shrink-0 border border-white/10 bg-[#0c0c10] px-3 py-2"
          >
            <p className="line-clamp-2 text-[11px] font-medium text-white">{row.name}</p>
            <p className="type-meta text-[10px] text-white/45">{String(row.start_date).slice(0, 10)}</p>
                    <SyncedActivityProfileToggle
                      stravaActivityId={row.strava_activity_id}
                      included={Boolean(row.profile_include)}
                    />
          </li>
        ))}
      </ul>
    </div>
  );
}
