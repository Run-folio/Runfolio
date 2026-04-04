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

function confidencePillClass(c: CatalogRaceSuggestion["confidence"]): string {
  if (c === "high") return "border-emerald-400/35 bg-emerald-500/10 text-emerald-100";
  if (c === "medium") return "border-amber-400/35 bg-amber-500/10 text-amber-100";
  return "border-white/15 bg-white/[0.06] text-white/70";
}

function confidenceShort(c: CatalogRaceSuggestion["confidence"]): string {
  if (c === "high") return "Strong";
  if (c === "medium") return "Review";
  return "Low";
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
  const src = activity.activity_source ?? "strava";
  const isStrava = src === "strava";

  const inner = (
    <>
      {photo ? (
        <div
          className="-mx-4 -mt-4 mb-3 h-28 w-[calc(100%+2rem)] max-w-none bg-cover bg-center"
          style={{ backgroundImage: `url("${photo.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")` }}
        />
      ) : null}
      {catalogSuggestion ? (
        <div className="mb-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full border border-accent/35 bg-accent/10 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent">
              Catalog
            </span>
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                confidencePillClass(catalogSuggestion.confidence)
              )}
            >
              {confidenceShort(catalogSuggestion.confidence)}
            </span>
            <span className="rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-0.5 text-[9px] font-semibold tabular-nums text-white/75">
              {Math.round(catalogSuggestion.score * 100)}%
            </span>
            {catalogSuggestion.onUserBucketList ? (
              <span className="rounded-full border border-gold/35 bg-gold/10 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-gold">
                Bucket
              </span>
            ) : null}
          </div>
          <p className="text-sm font-semibold leading-snug text-white">{catalogSuggestion.displayTitle}</p>
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 font-semibold leading-snug text-white line-clamp-2">{activity.name}</p>
        <span className="shrink-0 rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-muted">
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
          href={`/activities/${encodeURIComponent(activity.strava_id)}`}
          className="block p-4 pb-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label={`${activity.name}, view activity`}
        >
          {inner}
        </Link>
        <div className="border-t border-white/10 px-4 py-2">
          {isStrava && activity.strava_url.startsWith("http") ? (
            <a
              href={activity.strava_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[40px] items-center text-[10px] font-semibold uppercase tracking-wider text-accent hover:underline"
            >
              Strava
            </a>
          ) : (
            <span className="inline-flex min-h-[40px] items-center text-[10px] font-semibold uppercase tracking-wider text-white/45">
              File import
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("border border-border bg-[#0d0d0f] p-4", className)}>
      {inner}
      <div className="mt-2">
        {isStrava && activity.strava_url.startsWith("http") ? (
          <Link
            href={activity.strava_url}
            className="text-[10px] font-semibold uppercase tracking-wider text-accent hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Open in Strava
          </Link>
        ) : (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Imported file</span>
        )}
      </div>
    </div>
  );
}
