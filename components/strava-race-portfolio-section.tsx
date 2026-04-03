import Link from "next/link";
import type { Race, StravaFeedStats, StravaRaceCandidate } from "@/types";
import { StravaActivityCard } from "@/components/strava-activity-card";
import { StravaInsightsStrip } from "@/components/strava-insights-strip";
import { Card } from "@/components/ui/card";
import { getCatalogDisplayTitle } from "@/lib/discover-race-details";
import { getPortfolioRaceLabel } from "@/lib/portfolio-race-label";
import { getRaceSceneImagePath } from "@/lib/race-scene-images";
import { portfolioRaceHref } from "@/lib/profile-portfolio";
import { buildSetupUrl } from "@/lib/setup-url";

type Props = {
  candidates: StravaRaceCandidate[];
  raceCandidateStats: StravaFeedStats;
  matchedMajorDiscoverIds: string[];
  recentlyCompletedCatalog: Race[];
  stravaOAuthConfigured?: boolean;
  stravaOk: boolean;
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
  usingLiveRacePreviewOnly = false,
  layout = "dashboard",
  profileCurationMode = false
}: Props) {
  const isProfile = layout === "profile";
  const list = isProfile ? candidates.slice(0, 3) : candidates;
  if (!stravaOk) {
    return (
      <section className="space-y-6">
        <div>
          <p className="type-eyebrow">Race portfolio</p>
          <h2 className="type-section mt-2 text-lg md:text-xl">Imported race efforts</h2>
          <p className="type-meta mt-2 max-w-2xl text-sm">
            Connect Strava to surface long runs and race-like efforts (≥21 km, Run / Trail Run / Race). Shorter training,
            rides, and gym work stay out of this view.
          </p>
        </div>
        <Card className="border-dashed border-white/20 bg-panel/40 p-6 text-center">
          <p className="text-sm text-muted">
            Strava isn&apos;t connected or the feed couldn&apos;t load. Hook it up from{" "}
            <Link href="/matches" className="font-semibold text-accent underline-offset-4 hover:underline">
              Match &amp; import hub
            </Link>
            , the{" "}
            <Link href={buildSetupUrl("/dashboard")} className="font-semibold text-white/85 underline-offset-4 hover:underline">
              setup guide
            </Link>
            , or{" "}
            <Link href="/races/new" className="font-semibold text-white/70 underline-offset-4 hover:underline">
              Add race
            </Link>{" "}
            for a quick single import.
          </p>
          {stravaOAuthConfigured ? (
            <Link
              href="/api/strava/oauth/start"
              className="mt-4 inline-block text-sm font-semibold uppercase tracking-wider text-accent hover:underline"
            >
              Connect Strava
            </Link>
          ) : null}
        </Card>
      </section>
    );
  }

  if (candidates.length === 0) {
    return (
      <section className="space-y-6">
        <div>
          <p className="type-eyebrow">Race portfolio</p>
          <h2 className="type-section mt-2 text-lg md:text-xl">Imported race efforts</h2>
          <p className="type-meta mt-2 max-w-2xl text-sm">
            We only show activities that look like race-worthy running: <strong className="text-white/90">≥21 km</strong>{" "}
            and <strong className="text-white/90">Run, Trail Run, or Race</strong>. Rides, gym sessions, and short runs
            are filtered out.
          </p>
        </div>
        <Card className="border border-white/10 bg-panel/50 p-6">
          <p className="text-sm text-muted">
            No qualifying efforts in your latest Strava import. Keep training — your next marathon or ultra will show
            up here automatically.
          </p>
          <div className="mt-4 flex flex-wrap gap-4">
            <Link href="/matches" className="text-sm font-semibold uppercase tracking-wider text-accent hover:underline">
              Match &amp; import hub →
            </Link>
            <Link href="/races/new" className="text-sm font-semibold text-muted hover:text-white">
              One activity by URL →
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
            Long runs and race-type activities from Strava (≥21 km, Run / Trail Run / Race) surface in{" "}
            <strong className="text-white/90">Pending review</strong> until you approve them for your public portfolio.
            This block is context only — not a second feed.
          </p>
        </div>
        <StravaInsightsStrip stats={raceCandidateStats} context="race_candidates" />
      </section>
    );
  }

  return (
    <section className="space-y-10">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="type-eyebrow">Race portfolio</p>
          <h2 className="type-section mt-2 text-lg md:text-xl">Imported race efforts</h2>
          <p className="type-meta mt-2 max-w-2xl text-sm">
            Long runs and race-type activities from Strava — matched against the Runfolio major-race catalog. Confirm
            matches on{" "}
            <Link href="/races/new" className="text-accent underline-offset-4 hover:underline">
              Add race
            </Link>{" "}
            to log the story and complete bucket list goals.
          </p>
        </div>
        <Link href="/races/new" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent hover:underline">
          Confirm a match →
        </Link>
      </div>

      {usingLiveRacePreviewOnly && layout === "dashboard" ? (
        <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
          This strip is a <strong className="text-white">live Strava preview</strong> — nothing is saved in Runfolio yet.
          Use <strong className="text-white">Sync from Strava</strong> so Overview and Match &amp; Import share the same
          stored activities.
        </p>
      ) : null}

      <StravaInsightsStrip stats={raceCandidateStats} context="race_candidates" />

      {matchedMajorDiscoverIds.length > 0 ? (
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">Matched major races</p>
          <p className="type-meta mb-3 text-xs">
            Strong catalog matches from your recent efforts (tap through to the race library).
          </p>
          <div className="flex flex-wrap gap-2">
            {matchedMajorDiscoverIds.map((id) => (
              <Link
                key={id}
                href={`/races/${id}`}
                className="border border-accent/40 bg-accent/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-accent transition hover:bg-accent/20"
              >
                {getCatalogDisplayTitle(id)}
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                    <p className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-accent">Strava linked</p>
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
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">Longest race candidates</p>
          <div className="grid gap-3 md:grid-cols-3">
            {raceCandidateStats.topByDistance.map((a) => {
              const full = candidates.find((c) => c.strava_id === a.strava_id);
              return (
                <StravaActivityCard
                  key={`top-${a.strava_id}`}
                  activity={a}
                  catalogSuggestion={full?.catalogSuggestion ?? null}
                  linkToPortfolio
                />
              );
            })}
          </div>
        </div>
      ) : null}

      <div>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          {isProfile ? "Top race efforts" : "All race candidates"}
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(isProfile ? list : list.slice(0, 12)).map((a) => (
            <StravaActivityCard
              key={a.strava_id}
              activity={a}
              catalogSuggestion={a.catalogSuggestion}
              linkToPortfolio
            />
          ))}
        </div>
      </div>
    </section>
  );
}
