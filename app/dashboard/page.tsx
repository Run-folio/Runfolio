import Link from "next/link";
import { isDynamicServerError } from "next/dist/client/components/hooks-server-context";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { AppNavbar } from "@/components/app-navbar";
import { StravaOAuthResultBanner } from "@/components/strava-oauth-result-banner";
import { DataBackendSetupGate } from "@/components/data-backend-setup-gate";
import { CanonicalStravaMatchSuggestions } from "@/components/canonical-strava-match-suggestions";
import { DevMatchDebugSummary } from "@/components/dev-match-debug-summary";
import { ProfileBucketList } from "@/components/profile-bucket-list";
import { RaceJourney } from "@/components/race-journey";
import { StravaRacePortfolioSection } from "@/components/strava-race-portfolio-section";
import { StravaIncrementalSyncButton } from "@/components/strava-incremental-sync-button";
import { DashboardFeaturedRaceSummary } from "@/components/dashboard-featured-race-summary";
import { Card } from "@/components/ui/card";
import { ensurePublicUserRowForAuthedRequest } from "@/lib/auth-ensure-public-user-on-request";
import { getServerAuthUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import { demoUser, isSupabaseConfigured } from "@/lib/demo-mode";
import { loadDevMatchDebugSnapshot } from "@/lib/dev-match-debug-snapshot";
import { confirmedCompletedPortfolioRaces } from "@/lib/portfolio-race";
import { portfolioRaceHref } from "@/lib/profile-portfolio";
import { getRaceSceneImagePath } from "@/lib/race-scene-images";
import { runfolioLog } from "@/lib/runfolio-log";
import { fetchCanonicalBucketGoalsForUser } from "@/lib/bucket-list-canonical/queries";
import { buildCanonicalStravaSuggestionsForUser } from "@/lib/strava-canonical-match/suggestions";
import { listDismissedCanonicalStravaIds } from "@/lib/strava-sync/repository";
import { loadUserStravaOverviewState } from "@/lib/strava-user-overview";
import { raceCountsAsBucketListCompleted, raceIsBucketListFutureGoal } from "@/lib/bucket-list-model";
import {
  computeStravaFeedStats,
  dedupeHighConfidenceDiscoverIds,
  enrichRaceCandidatesWithCatalogMatches
} from "@/lib/strava-race-candidates";
import { resolveDefaultProfilePathForUser } from "@/lib/profile-path-server";
import { requirePersistenceReadyOrRedirect } from "@/lib/require-persistence-ready";
import { loadStravaBackfillProgress } from "@/lib/strava-backfill-progress";
import { hasServerRecordedStravaBackfillBatch } from "@/lib/strava-backfill-model";
import type { Race } from "@/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <DataBackendSetupGate
        title="Overview"
        featureLabel="Your dashboard, bucket list, and Strava sync"
        returnTo="/dashboard"
      />
    );
  }

  await requirePersistenceReadyOrRedirect("/dashboard");

  const stravaOAuthConfigured = Boolean(
    process.env.STRAVA_CLIENT_ID?.trim() && process.env.STRAVA_CLIENT_SECRET?.trim()
  );

  let userName = demoUser.name;
  let races: Race[] = [];
  let canonicalFuture: Awaited<ReturnType<typeof fetchCanonicalBucketGoalsForUser>>["future"] = [];
  let canonicalCompleted: Awaited<ReturnType<typeof fetchCanonicalBucketGoalsForUser>>["completed"] = [];
  let canonicalStravaSuggestions: Awaited<ReturnType<typeof buildCanonicalStravaSuggestionsForUser>> = [];
  let confirmReturnTo = "/dashboard";
  let stravaOverview: Awaited<ReturnType<typeof loadUserStravaOverviewState>> | null = null;
  let stravaBackfillProgress: Awaited<ReturnType<typeof loadStravaBackfillProgress>> | null = null;
  let devMatchDebug: Awaited<ReturnType<typeof loadDevMatchDebugSnapshot>> | null = null;
  try {
    const { user, authError } = await getServerAuthUser();
    if (authError) throw new Error(authError);
    if (!user) redirect("/auth/login");
    const supabase = await createClient();
    await ensurePublicUserRowForAuthedRequest(supabase, user);
    stravaOverview = await loadUserStravaOverviewState(supabase, user.id);
    stravaBackfillProgress = await loadStravaBackfillProgress(supabase, user.id);
    userName = user.user_metadata?.name ?? "Your Runfolio";
    const result = await supabase.from("races").select("*").eq("user_id", user.id).order("date", { ascending: false });
    if (result.error) {
      runfolioLog.warn("Dashboard.races", result.error.message ?? "query error");
      races = [];
    } else {
      races = result.data ?? [];
    }
    const canon = await fetchCanonicalBucketGoalsForUser(supabase, user.id);
    canonicalFuture = canon.future;
    canonicalCompleted = canon.completed;
    const profilePath = await resolveDefaultProfilePathForUser(supabase, user.id);
    confirmReturnTo =
      profilePath === "/dashboard" ? "/dashboard" : `${profilePath}#profile-completed-races`;
    if (process.env.NODE_ENV === "development") {
      devMatchDebug = await loadDevMatchDebugSnapshot(
        supabase,
        user.id,
        user,
        {
          page: "dashboard",
          profileSlugFromUrl: profilePath !== "/dashboard" ? profilePath.replace(/^\//, "") : undefined
        },
        { portfolioRaces: races, stravaOverview }
      );
    }
    try {
      const synced = stravaOverview!.syncedRows;
      const dismissed = await listDismissedCanonicalStravaIds(supabase, user.id);
      const portfolioStravaIds = new Set(
        (races ?? []).map((r) => r.strava_activity_id).filter((x): x is string => Boolean(x?.trim()))
      );
      canonicalStravaSuggestions = await buildCanonicalStravaSuggestionsForUser({
        rows: synced,
        dismissedStravaIds: dismissed,
        portfolioStravaIds
      });
    } catch (matchErr) {
      runfolioLog.warn(
        "Dashboard.canonicalStravaSuggestions",
        matchErr instanceof Error ? matchErr.message : "failed"
      );
      canonicalStravaSuggestions = [];
    }
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("Dashboard.supabase", e);
    throw e;
  }

  if (!stravaOverview) {
    throw new Error("Strava overview failed to load");
  }

  const completedSorted = [...confirmedCompletedPortfolioRaces(races ?? [])].sort((a, b) =>
    String(b.date ?? "").localeCompare(String(a.date ?? ""))
  );
  const future = (races ?? []).filter((race) => !race.is_completed);
  const futureGoalCount =
    future.filter(raceIsBucketListFutureGoal).length + canonicalFuture.length;
  const featured = completedSorted[0];
  const totalKm = completedSorted.reduce((acc, race) => acc + (race.distance_km ?? 0), 0);

  const stravaFeed = stravaOverview.feed;
  const usingLiveRacePreviewOnly = stravaOverview.usingLiveRacePreviewOnly;
  const raceStripActivities = stravaOverview.raceActivitiesForDiscoverStrip;
  const stravaRaceEnriched =
    raceStripActivities.length > 0
      ? enrichRaceCandidatesWithCatalogMatches(raceStripActivities, races ?? [])
      : [];
  const hasSyncedStravaRows = stravaOverview.syncedRows.length > 0;
  const stravaPortfolioShowsStrip = stravaFeed.ok || stravaRaceEnriched.length > 0 || hasSyncedStravaRows;
  const matchedMajorDiscoverIds = dedupeHighConfidenceDiscoverIds(stravaRaceEnriched);
  const raceStripStats = computeStravaFeedStats(raceStripActivities);
  const recentlyCompletedCatalog = completedSorted
    .filter((r) => Boolean(r.discover_race_id))
    .slice(0, 6);

  const showFirstTimeStravaBackfill =
    stravaOAuthConfigured &&
    stravaBackfillProgress != null &&
    stravaBackfillProgress.ingestStateTableAvailable &&
    stravaBackfillProgress.syncedActivityCount === 0 &&
    !hasServerRecordedStravaBackfillBatch(stravaBackfillProgress) &&
    stravaBackfillProgress.phase !== "complete" &&
    stravaBackfillProgress.phase !== "no_matches";

  return (
    <>
      <AppNavbar />
      <section className="hero-full min-h-[420px] md:min-h-[480px]">
        <div className="hero-bg" style={{ backgroundImage: "url('/photos/placeholders/9.png')" }} />
        <div className="hero-overlay" />
        <div className="hero-inner flex flex-col gap-8 pb-4 md:flex-row md:items-end md:justify-between md:gap-10 md:pb-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:gap-10">
            <div
              className="h-24 w-24 shrink-0 rounded-full border-2 border-accent bg-cover bg-center shadow-[0_0_0_1px_rgba(232,122,61,0.35)] sm:h-28 sm:w-28"
              style={{ backgroundImage: "url('/photos/placeholders/8.png')" }}
              role="img"
              aria-label="Profile"
            />
            <div className="min-w-0 flex-1">
              <p className="type-eyebrow">Runner Portfolio</p>
              <h1 className="type-display mt-3 max-w-[18ch] leading-[1.05]">{userName}</h1>
              <div className="mt-6 grid max-w-2xl grid-cols-3 gap-x-3 gap-y-5 border-t border-white/10 pt-6 sm:gap-x-6">
                {[
                  { label: "Races", value: String(completedSorted.length) },
                  { label: "Portfolio km", value: totalKm >= 10 ? `${totalKm.toFixed(0)}` : totalKm.toFixed(1) },
                  { label: "Up next", value: String(future.length) }
                ].map((s) => (
                  <div key={s.label} className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-accent sm:text-[10px] sm:tracking-[0.2em]">
                      {s.label}
                    </p>
                    <p className="mt-1.5 truncate text-2xl font-bold tabular-nums text-white sm:mt-2 sm:text-3xl">
                      {s.label === "Portfolio km" ? `${s.value} km` : s.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap md:w-auto md:flex-col md:items-end">
            <Link
              href="/my-races"
              className="inline-flex min-h-[48px] w-full items-center justify-center rounded-[12px] bg-accent px-4 py-2 text-center text-[13px] font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-[#f08a4d] sm:flex-1 md:w-full md:min-w-[12rem]"
            >
              My Races
            </Link>
            <Link
              href="/races/new"
              className="inline-flex min-h-[48px] w-full items-center justify-center rounded-[12px] border border-border bg-panelAlt px-4 py-2 text-center text-[13px] font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-slate-800 sm:flex-1 md:w-full md:min-w-[12rem]"
            >
              Add Race
            </Link>
          </div>
        </div>
      </section>

      <main className="app-shell space-y-16">
        <StravaOAuthResultBanner />
        <section>
          <div className="mb-5 flex flex-col justify-between gap-3 sm:mb-6 sm:flex-row sm:items-end">
            <div>
              <p className="type-eyebrow">Highlights</p>
              <h2 className="type-section mt-1 text-lg md:mt-2 md:text-xl">Race Highlights</h2>
            </div>
            <Link
              href="/races/new"
              className="min-h-[44px] shrink-0 content-center text-[11px] font-semibold uppercase tracking-[0.2em] text-accent sm:min-h-0"
            >
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {completedSorted.length === 0 ? (
              <Card className="col-span-full border-dashed border-white/15 bg-panel/40 p-8 text-center sm:col-span-2 lg:col-span-4">
                <p className="text-sm font-semibold text-white">No highlights yet</p>
                <p className="type-meta mx-auto mt-2 max-w-sm text-xs">
                  Import or add a race — your confirmed finishes show here.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-4">
                  <Link
                    href="/my-races"
                    className="inline-block text-[11px] font-semibold uppercase tracking-[0.15em] text-accent hover:underline"
                  >
                    My Races →
                  </Link>
                  <Link
                    href="/races/new"
                    className="inline-block text-[11px] font-semibold uppercase tracking-[0.15em] text-white/55 hover:underline"
                  >
                    Add race →
                  </Link>
                </div>
              </Card>
            ) : (
              completedSorted.slice(0, 4).map((race, i) => {
                const href = portfolioRaceHref(race);
                const isExternal = href.startsWith("http");
                const lift =
                  "transition duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_20px_50px_-18px_rgba(232,122,61,0.5)] group-hover:ring-1 group-hover:ring-accent/30";
                const cardShell = cn("overflow-hidden p-0", lift, i === 0 ? "border-accent ring-1 ring-accent/40" : "");
                const inner = (
                  <>
                    <div
                      className="aspect-[4/3] bg-cover bg-center transition duration-200 group-hover:brightness-105"
                      style={{ backgroundImage: `url('${getRaceSceneImagePath(race.name)}')` }}
                    />
                    <div className="border-t border-border p-4">
                      <p className="font-semibold uppercase tracking-[0.04em] text-white">{race.name}</p>
                      <p className="type-meta mt-1 text-xs">
                        {race.distance_km} km · {race.elevation_m ?? "—"} m · {race.time ?? "—"}
                      </p>
                    </div>
                  </>
                );
                const wrapClass =
                  "group block h-full min-h-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer active:opacity-95";
                return isExternal ? (
                  <a key={race.id} href={href} target="_blank" rel="noreferrer" className={wrapClass}>
                    <Card className={cardShell}>{inner}</Card>
                  </a>
                ) : (
                  <Link key={race.id} href={href} className={wrapClass}>
                    <Card className={cardShell}>{inner}</Card>
                  </Link>
                );
              })
            )}
          </div>
        </section>

        {stravaOAuthConfigured ? (
          <section
            className={cn(
              "rounded-[14px] border border-white/10 bg-panel/30 p-4 md:p-5",
              showFirstTimeStravaBackfill && "border-accent/35 shadow-[0_0_0_1px_rgba(232,122,61,0.2)]"
            )}
          >
            <h2 className="sr-only">Strava import and sync</h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/my-races#import-strava"
                className="inline-flex min-h-[48px] w-full flex-1 items-center justify-center rounded-[12px] bg-accent px-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-[#f08a4d] sm:max-w-xs"
              >
                Import from Strava
              </Link>
              <StravaIncrementalSyncButton
                subtle
                syncLabel="Sync new activities"
                className="w-full flex-1 sm:w-auto sm:min-w-[11rem] [&_button]:min-h-[48px] [&_button]:w-full [&_button]:justify-center sm:[&_button]:w-auto"
              />
            </div>
            {!stravaFeed.ok && stravaOverview.syncedRows.length > 0 ? (
              <p className="mt-3 text-xs text-amber-200/90" role="status">
                Live feed unavailable — saved activities still show below.
                {stravaFeed.errorMessage ? ` (${stravaFeed.errorMessage})` : ""}
              </p>
            ) : null}
            {!stravaFeed.ok && stravaOverview.syncedRows.length === 0 ? (
              <p className="mt-3 text-xs text-amber-200/90" role="status">
                {stravaFeed.errorMessage ?? "Connect Strava or sync to load activities."}
              </p>
            ) : null}
            <div className="mt-5">
              <CanonicalStravaMatchSuggestions
                suggestions={canonicalStravaSuggestions}
                returnAfterConfirm={confirmReturnTo}
                compact
              />
            </div>
          </section>
        ) : null}

        <StravaRacePortfolioSection
          candidates={stravaRaceEnriched}
          raceCandidateStats={raceStripStats}
          matchedMajorDiscoverIds={matchedMajorDiscoverIds}
          recentlyCompletedCatalog={recentlyCompletedCatalog}
          stravaOAuthConfigured={stravaOAuthConfigured}
          stravaOk={stravaPortfolioShowsStrip}
          stravaLiveFeedOk={stravaFeed.ok}
          stravaFeedErrorMessage={stravaFeed.errorMessage}
          hasSyncedStravaRows={hasSyncedStravaRows}
          usingLiveRacePreviewOnly={usingLiveRacePreviewOnly}
        />

        <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 right-auto border-y border-border bg-[#05070c]">
          <div className="mx-auto w-full max-w-[1400px] border-x border-border">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
              <RaceJourney races={completedSorted} />
              <ProfileBucketList
                completed={completedSorted.filter(raceCountsAsBucketListCompleted)}
                future={future.filter(raceIsBucketListFutureGoal)}
                canonicalFuture={canonicalFuture}
                canonicalCompleted={canonicalCompleted}
              />
            </div>
          </div>
        </div>

        {featured ? <DashboardFeaturedRaceSummary races={completedSorted.slice(0, 6)} /> : null}

        <section className="grid grid-cols-2 gap-x-3 gap-y-5 border border-border bg-panel/50 p-5 sm:grid-cols-3 sm:gap-4 md:p-6 lg:grid-cols-6">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted sm:text-[10px] sm:tracking-[0.2em]">
              Portfolio km
            </p>
            <p className="mt-1.5 truncate text-2xl font-bold tabular-nums sm:mt-2 sm:text-3xl">{totalKm.toFixed(1)} km</p>
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted sm:text-[10px] sm:tracking-[0.2em]">Races</p>
            <p className="mt-1.5 text-2xl font-bold tabular-nums sm:mt-2 sm:text-3xl">{completedSorted.length}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted sm:text-[10px] sm:tracking-[0.2em]">Goals</p>
            <p className="mt-1.5 text-2xl font-bold tabular-nums sm:mt-2 sm:text-3xl">{futureGoalCount}</p>
          </div>
          {stravaFeed.ok ? (
            <>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase leading-snug tracking-[0.14em] text-accent sm:text-[10px] sm:tracking-[0.2em]">
                  Race candidate km
                </p>
                <p className="mt-1.5 truncate text-2xl font-bold tabular-nums text-white sm:mt-2 sm:text-3xl">
                  {raceStripStats.totalDistanceKm} km
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase leading-snug tracking-[0.14em] text-accent sm:text-[10px] sm:tracking-[0.2em]">
                  Race candidates
                </p>
                <p className="mt-1.5 text-2xl font-bold tabular-nums text-white sm:mt-2 sm:text-3xl">
                  {raceStripStats.activityCount}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase leading-snug tracking-[0.14em] text-accent sm:text-[10px] sm:tracking-[0.2em]">
                  Candidate elev.
                </p>
                <p className="mt-1.5 text-2xl font-bold tabular-nums text-white sm:mt-2 sm:text-3xl">
                  {raceStripStats.totalElevationM} m
                </p>
              </div>
            </>
          ) : null}
        </section>
      </main>
      {devMatchDebug ? <DevMatchDebugSummary snapshot={devMatchDebug} /> : null}
    </>
  );
}
