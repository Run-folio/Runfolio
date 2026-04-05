import Link from "next/link";
import type { Race, StravaFeedStats, StravaRaceCandidate } from "@/types";
import { ProgressiveRevealGrid } from "@/components/progressive-reveal-grid";
import { StravaActivityCard } from "@/components/strava-activity-card";
import { StravaInsightsStrip } from "@/components/strava-insights-strip";
import { Card } from "@/components/ui/card";
import { getCatalogDisplayTitle } from "@/lib/discover-race-details";
import { getPortfolioRaceLabel } from "@/lib/portfolio-race-label";
import { getRaceSceneImagePath } from "@/lib/race-scene-images";
import { portfolioRaceHref } from "@/lib/profile-portfolio";
import { OVERVIEW_PATH } from "@/lib/app-paths";
import { buildSetupUrl } from "@/lib/setup-url";
import { cn } from "@/lib/utils";

type Props = {
  candidates: StravaRaceCandidate[];
  raceCandidateStats: StravaFeedStats;
  matchedMajorDiscoverIds: string[];
  recentlyCompletedCatalog: Race[];
  stravaOAuthConfigured?: boolean;
  /** True when the user has anything to show: live feed, strip candidates, or stored sync rows. */
  stravaOk: boolean;
  /** Live Strava list API succeeded this request (distinct from DB-backed strip). */
  stravaLiveFeedOk?: boolean;
  stravaFeedErrorMessage?: string;
  /** User has rows in `strava_synced_activities` (may still have an empty overview strip). */
  hasSyncedStravaRows?: boolean;
  /** Overview strip is live Strava only until Sync fills the database. */
  usingLiveRacePreviewOnly?: boolean;
  /** Profile page: tighter slice, no full grid of candidates. */
  layout?: "dashboard" | "profile";
  /** Profile: only stats + copy — candidates are curated in “Pending review” above. */
  profileCurationMode?: boolean;
};

export function StravaRacePortfolioSection({
  candidates,
  raceCandidateStats,
  matchedMajorDiscoverIds,
  recentlyCompletedCatalog,
  stravaOAuthConfigured = false,
  stravaOk,
  stravaLiveFeedOk = true,
  stravaFeedErrorMessage,
  hasSyncedStravaRows = false,
  usingLiveRacePreviewOnly = false,
  layout = "dashboard",
  profileCurationMode = false
}: Props) {
  const isProfile = layout === "profile";
  const list = isProfile ? candidates.slice(0, 3) : candidates;
  if (!stravaOk) {
    return (
      <section className="space-y-4">
        <div>
          {isProfile ? <p className="type-eyebrow">Race portfolio</p> : null}
          <h2 className={cn("type-section text-lg md:text-xl", isProfile && "mt-2")}>Imported race efforts</h2>
          {!isProfile ? null : (
            <p className="type-meta mt-2 max-w-2xl text-sm">
              Connect Strava to surface long runs and trail efforts (about <strong className="text-white/90">12 km</strong>{" "}
              and up, run-like sports). Rides and gym work stay out of this view.
            </p>
          )}
        </div>
        <Card className="border-dashed border-white/20 bg-panel/40 p-5 text-center md:p-6">
          <p className="text-sm text-muted">
            {stravaFeedErrorMessage ? stravaFeedErrorMessage : "Strava isn’t connected or the feed couldn’t load."}{" "}
            <Link href="/my-races" className="font-semibold text-teal underline-offset-4 hover:text-teal-hover hover:underline">
              My Races
            </Link>
            {!isProfile ? null : (
              <>
                {" · "}
                <Link href={buildSetupUrl(OVERVIEW_PATH)} className="font-semibold text-white/85 underline-offset-4 hover:underline">
                  Setup
                </Link>
                {" · "}
                <Link href="/races/new" className="font-semibold text-white/70 underline-offset-4 hover:underline">
                  Add race
                </Link>
              </>
            )}
          </p>
          {stravaOAuthConfigured ? (
            <Link
              href={`/api/strava/oauth/start?next=${encodeURIComponent(OVERVIEW_PATH)}`}
              className="mt-4 inline-flex min-h-[44px] items-center justify-center text-sm font-semibold uppercase tracking-wider text-teal hover:text-teal-hover hover:underline"
            >
              Connect Strava
            </Link>
          ) : null}
        </Card>
      </section>
    );
  }

  if (candidates.length === 0) {
    const overviewLayout = layout === "dashboard";
    return (
      <section className="space-y-4">
        <div>
          {overviewLayout ? null : <p className="type-eyebrow">Race portfolio</p>}
          <h2 className={cn("type-section text-lg md:text-xl", !overviewLayout && "mt-2")}>Imported race efforts</h2>
          {!overviewLayout ? (
            <p className="type-meta mt-2 max-w-2xl text-sm">
              We favor race-shaped running: roughly <strong className="text-white/90">12 km+</strong>,{" "}
              <strong className="text-white/90">run / trail / virtual run</strong>, and related types. Rides and short
              casual jogs stay out of this strip.
            </p>
          ) : null}
        </div>
        {stravaLiveFeedOk === false ? (
          <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100/90 sm:text-sm" role="status">
            Live feed didn&apos;t load{stravaFeedErrorMessage ? ` — ${stravaFeedErrorMessage}` : ""}.
            {hasSyncedStravaRows ? " Saved activities still available — open My Races." : " Reconnect and sync, or add by URL."}
          </p>
        ) : null}
        <Card className="border border-white/10 bg-panel/50 p-4 md:p-5">
          <p className="text-sm text-muted">
            {hasSyncedStravaRows
              ? "Nothing new to show in this strip — linked, snoozed, or outside the distance window."
              : "No qualifying efforts yet — sync Strava or use My Races."}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/my-races" className="min-h-[44px] content-center text-sm font-semibold uppercase tracking-wider text-teal hover:text-teal-hover hover:underline">
              My Races
            </Link>
            <Link href="/races/new" className="min-h-[44px] content-center text-sm font-semibold text-muted hover:text-white">
              Add by URL
            </Link>
          </div>
        </Card>
      </section>
    );
  }

  if (isProfile && profileCurationMode) {
    return (
      <section className="space-y-6">
        <div>
          <p className="type-eyebrow">Strava import</p>
          <h2 className="type-section mt-2 text-lg md:text-xl">Race-shaped efforts</h2>
          <p className="type-meta mt-2 max-w-2xl text-sm">
            Long runs and race-type activities from Strava (about 12 km+, run-like types) surface in{" "}
            <strong className="text-white/90">Pending review</strong> until you approve them for your public portfolio.
            This block is context only — not a second feed.
          </p>
        </div>
        <StravaInsightsStrip stats={raceCandidateStats} context="race_candidates" />
      </section>
    );
  }

  const dashOverview = layout === "dashboard";

  return (
    <section className="space-y-6 md:space-y-8">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0">
          {dashOverview ? null : <p className="type-eyebrow">Race portfolio</p>}
          <h2 className={cn("type-section text-lg md:text-xl", !dashOverview && "mt-2")}>Imported race efforts</h2>
          {!dashOverview ? (
            <p className="type-meta mt-2 max-w-2xl text-sm">
              Long runs and race-type activities from Strava — matched against the Runfolio major-race catalog. Confirm
              matches on{" "}
              <Link href="/races/new" className="text-teal underline-offset-4 hover:text-teal-hover hover:underline">
                Add race
              </Link>{" "}
              to log the story and complete bucket list goals.
            </p>
          ) : null}
        </div>
        <Link
          href="/races/new"
          className="min-h-[44px] shrink-0 content-center text-[11px] font-semibold uppercase tracking-[0.2em] text-teal hover:text-teal-hover hover:underline sm:min-h-0"
        >
          {dashOverview ? "Add race →" : "Confirm a match →"}
        </Link>
      </div>

      {stravaLiveFeedOk === false && layout === "dashboard" ? (
        <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100/90 sm:text-sm" role="status">
          Live feed offline{stravaFeedErrorMessage ? ` — ${stravaFeedErrorMessage}` : ""}. Showing last sync.
        </p>
      ) : null}

      {usingLiveRacePreviewOnly && layout === "dashboard" ? (
        <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100/90 sm:text-sm">
          Preview — <span className="font-medium text-white">Sync new activities</span> on Overview to save to Runfolio.
        </p>
      ) : null}

      <StravaInsightsStrip stats={raceCandidateStats} context="race_candidates" />

      {matchedMajorDiscoverIds.length > 0 ? (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold md:mb-3">Matched major races</p>
          {!dashOverview ? (
            <p className="type-meta mb-3 text-xs">
              Strong catalog matches from your recent efforts (tap through to the race library).
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {matchedMajorDiscoverIds.map((id) => (
              <Link
                key={id}
                href={`/races/${id}`}
                className={
                  dashOverview
                    ? "inline-flex max-w-full items-center rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-medium leading-normal tracking-normal text-white/75 transition hover:border-white/20 hover:bg-white/[0.1] hover:text-white/90"
                    : "border border-accent/40 bg-accent/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-accent transition hover:bg-accent/20"
                }
              >
                <span className="truncate">{getCatalogDisplayTitle(id)}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {!isProfile && recentlyCompletedCatalog.length > 0 ? (
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-green-400">
            Recently completed · catalog-linked
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recentlyCompletedCatalog.map((race) => {
              const label = getPortfolioRaceLabel(race);
              return (
              <Link
                key={race.id}
                href={portfolioRaceHref(race)}
                className="group flex overflow-hidden rounded-lg border border-white/10 bg-[#0d0d0f] transition hover:border-green-500/40"
              >
                <div
                  className="h-24 w-28 shrink-0 bg-cover bg-center"
                  style={{ backgroundImage: `url('${getRaceSceneImagePath(label)}')` }}
                />
                <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2">
                  <p className="truncate text-sm font-semibold text-white">{label}</p>
                  <p className="type-meta truncate text-[11px]">{race.date ?? "—"}</p>
                  {race.strava_activity_id ? (
                    <span className="mt-1.5 inline-flex w-fit rounded-full border border-accent/35 bg-accent/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent">
                      Strava
                    </span>
                  ) : null}
                </div>
              </Link>
            );
            })}
          </div>
        </div>
      ) : null}

      {!isProfile && raceCandidateStats.topByDistance.length > 0 ? (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold md:mb-3">
            Longest race candidates
          </p>
          <ProgressiveRevealGrid
            items={raceCandidateStats.topByDistance}
            getKey={(a) => `top-${a.strava_id}`}
            renderItem={(a) => {
              const full = candidates.find((c) => c.strava_id === a.strava_id);
              return (
                <StravaActivityCard
                  activity={a}
                  catalogSuggestion={full?.catalogSuggestion ?? null}
                  linkToPortfolio
                />
              );
            }}
            gridClassName="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3"
          />
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted md:mb-3">
          {isProfile ? "Top race efforts" : "All race candidates"}
        </p>
        <ProgressiveRevealGrid
          items={isProfile ? list : candidates}
          getKey={(a) => a.strava_id}
          renderItem={(a) => (
            <StravaActivityCard activity={a} catalogSuggestion={a.catalogSuggestion} linkToPortfolio />
          )}
          gridClassName="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        />
      </div>
    </section>
  );
}
