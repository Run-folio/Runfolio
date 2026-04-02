import Link from "next/link";
import type { StravaFeedActivity } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  activity: StravaFeedActivity;
  onSelect?: () => void;
  className?: string;
};

export function StravaActivityCard({ activity, onSelect, className }: Props) {
  const loc = [activity.location_city, activity.location_country].filter(Boolean).join(", ") || "—";
  const sport = activity.sport_type || activity.type || "Activity";

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold leading-snug text-white line-clamp-2">{activity.name}</p>
        <span className="shrink-0 border border-white/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted">
          {sport}
        </span>
      </div>
      <p className="type-meta mt-2 text-[11px]">
        {activity.start_date.slice(0, 10)} · {loc}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-accent">Dist</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">{activity.distance_km} km</p>
        </div>
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-accent">Moving</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">{activity.moving_time_label}</p>
        </div>
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-accent">Elev</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">
            {activity.elevation_m != null ? `${activity.elevation_m} m` : "—"}
          </p>
        </div>
      </div>
      <div className="mt-2 text-[10px] text-muted">
        <span>
          {activity.kudos_count} kudos · {activity.achievement_count} achievements
        </span>
      </div>
      {activity.summary_polyline ? (
        <div
          className="mt-3 h-14 w-full rounded-md border border-white/10 bg-gradient-to-br from-accent/10 via-black/40 to-black/60"
          aria-hidden
        />
      ) : null}
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "w-full border border-border bg-[#0d0d0f] p-4 text-left transition hover:border-accent/40 hover:bg-black/50",
          className
        )}
      >
        {inner}
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-accent">Use for race →</p>
      </button>
    );
  }

  return (
    <div className={cn("border border-border bg-[#0d0d0f] p-4", className)}>
      {inner}
      <div className="mt-2">
        <Link href={activity.strava_url} className="text-[10px] font-semibold uppercase tracking-wider text-accent hover:underline" target="_blank" rel="noreferrer">
          Open in Strava
        </Link>
      </div>
    </div>
  );
}
