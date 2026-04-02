import Link from "next/link";
import type { CatalogRaceSuggestion, StravaFeedActivity } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  activity: StravaFeedActivity;
  onSelect?: () => void;
  className?: string;
  /** Best catalog match for display — does not persist until the user confirms. */
  catalogSuggestion?: CatalogRaceSuggestion | null;
  /** Whole card links to `/activities/[id]` (dashboard / profile portfolio). */
  linkToPortfolio?: boolean;
};

function confidenceShort(c: CatalogRaceSuggestion["confidence"]): string {
  if (c === "high") return "High match";
  if (c === "medium") return "Possible match";
  return "Weak match";
}

export function StravaActivityCard({
  activity,
  onSelect,
  className,
  catalogSuggestion,
  linkToPortfolio = false
}: Props) {
  const loc = [activity.location_city, activity.location_country].filter(Boolean).join(", ") || "—";
  const sport = activity.sport_type || activity.type || "Activity";
  const photo = activity.primary_photo_url;

  const inner = (
    <>
      {photo ? (
        <div
          className="-mx-4 -mt-4 mb-3 h-28 w-[calc(100%+2rem)] max-w-none bg-cover bg-center"
          style={{ backgroundImage: `url("${photo.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")` }}
        />
      ) : null}
      {catalogSuggestion ? (
        <div className="mb-3 border border-accent/35 bg-accent/10 px-2.5 py-2">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-accent">Likely major race</p>
          <p className="mt-1 text-sm font-semibold leading-snug text-white">{catalogSuggestion.displayTitle}</p>
          <p className="type-meta mt-1 text-[10px]">
            {confidenceShort(catalogSuggestion.confidence)} · {Math.round(catalogSuggestion.score * 100)}% ·{" "}
            {catalogSuggestion.onUserBucketList ? "On your bucket list" : "Not on bucket list"}
          </p>
        </div>
      ) : null}
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

  if (linkToPortfolio) {
    return (
      <div
        className={cn(
          "border border-border bg-[#0d0d0f] transition hover:border-accent/40 hover:bg-black/50",
          className
        )}
      >
        <Link
          href={`/activities/${activity.strava_id}`}
          className="block p-4 pb-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {inner}
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-white/90">
            Race portfolio page →
          </p>
        </Link>
        <div className="border-t border-white/10 px-4 pb-3 pt-2">
          <a
            href={activity.strava_url}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] font-semibold uppercase tracking-wider text-accent hover:underline"
          >
            Open in Strava
          </a>
        </div>
      </div>
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
