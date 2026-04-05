import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { AppNavbar } from "@/components/app-navbar";
import { RaceCommunityFinishersSection } from "@/components/race-community-finishers";
import { raceIsBucketListFutureGoal, raceIsBucketListItem } from "@/lib/bucket-list-model";
import { getDiscoverRaceDetail, isDiscoverCatalogRaceId } from "@/lib/discover-race-details";
import { formatDiscoverDistance } from "@/lib/discover-races";
import { getRaceById } from "@/lib/get-race-by-id";
import { portfolioRaceHref } from "@/lib/profile-portfolio";
import { getServerAuthUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import { RaceCatalogPortfolioControls } from "@/components/race-catalog-portfolio-controls";
import { RaceDiscoverPortfolioActions } from "@/components/race-discover-portfolio-actions";
import { usedStravaActivityIdsFromRaces } from "@/lib/catalog-discover-user-state";
import { confirmedCompletedPortfolioRaces } from "@/lib/portfolio-race";
import { isSupabaseConfigured } from "@/lib/demo-mode";
import { parseActivityPageId } from "@/lib/activity-route-id";
import { getDiscoverRaceById } from "@/lib/known-race-match";
import { getStravaConnectionStubFeed } from "@/lib/strava-feed";
import { isStravaManualLinkPoolActivity, rankStravaActivitiesForDiscoverRace } from "@/lib/strava-race-candidates";
import { listSyncedActivitiesForUser } from "@/lib/strava-sync/repository";
import { syncedRowToStravaFeedActivity } from "@/lib/strava-sync/synced-row-to-feed";
import { CanonicalRaceDetailView } from "@/components/canonical-race-detail/canonical-race-detail-view";
import { CanonicalRaceCatalogOffline } from "@/components/canonical-race-detail/catalog-offline";
import {
  fetchPublicFinishersForCanonicalRace,
  fetchPublicFinishersForDiscoverRace,
  type PublicRaceFinisher
} from "@/lib/supabase/public-race-finishers";
import { getCachedCanonicalDetailResult } from "@/lib/races/canonical/detail-cache";
import { fetchCanonicalRaceViewerState } from "@/lib/races/canonical/detail-user-state";
import { formatCanonicalLocation } from "@/lib/races/canonical/detail-presentational";
import type { DiscoverStravaActivityCandidate, Race } from "@/types";

type Props = {
  params: Promise<{ raceId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { raceId } = await params;
  if (isDiscoverCatalogRaceId(raceId)) {
    const d = getDiscoverRaceDetail(raceId);
    if (!d) return { title: "Race · Runfolio" };
    return { title: `${d.displayTitle} · Runfolio` };
  }
  const canonRes = await getCachedCanonicalDetailResult(raceId);
  if (canonRes.ok && canonRes.data) {
    const c = canonRes.data;
    const loc = formatCanonicalLocation(c);
    return {
      title: `${c.name} · Runfolio`,
      description: loc ? `${c.name} — ${loc}. Verified race on Runfolio.` : `${c.name} · Verified race on Runfolio.`
    };
  }
  return { title: "Race · Runfolio" };
}

function surfaceLabel(s: "road" | "trail" | "mixed"): string {
  if (s === "road") return "Road";
  if (s === "trail") return "Trail";
  return "Mixed";
}

export default async function RaceIdRouterPage({ params }: Props) {
  const { raceId } = await params;

  if (isDiscoverCatalogRaceId(raceId)) {
    const detail = getDiscoverRaceDetail(raceId);
    if (!detail) notFound();

    let userMatch: Race | null = null;
    let bucketFuture: Race | null = null;
    let catalogOwner = false;
    let stravaCandidates: DiscoverStravaActivityCandidate[] = [];
    let stravaOk = false;
    let stravaFeedError: string | undefined;
    let stravaSyncedActivityCount = 0;
    let stravaManualEligibleCount = 0;
    let publicFinishers: PublicRaceFinisher[] = [];
    let discoverViewerId: string | null = null;
    const stravaOAuthConfigured = Boolean(
      process.env.STRAVA_CLIENT_ID?.trim() && process.env.STRAVA_CLIENT_SECRET?.trim()
    );
    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient();
        const [{ user }, finishers] = await Promise.all([
          getServerAuthUser(),
          fetchPublicFinishersForDiscoverRace(supabase, raceId, 40)
        ]);
        publicFinishers = finishers;
        discoverViewerId = user?.id ?? null;
        catalogOwner = Boolean(user?.id);
        if (user?.id) {
          const [racesRes, feed, syncedRows] = await Promise.all([
            supabase.from("races").select("*").eq("user_id", user.id).order("date", { ascending: false }),
            getStravaConnectionStubFeed(),
            listSyncedActivitiesForUser(supabase, user.id)
          ]);
          const allRaces = (racesRes.data as Race[]) ?? [];
          const portfolioRows = allRaces.filter((r) => r.discover_race_id === raceId);
          const confirmed = confirmedCompletedPortfolioRaces(portfolioRows);
          userMatch =
            [...confirmed].sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))[0] ?? null;
          bucketFuture = portfolioRows.find((r) => !r.is_completed && raceIsBucketListFutureGoal(r)) ?? null;

          const usedStrava = usedStravaActivityIdsFromRaces(allRaces);
          stravaOk = feed.ok;
          stravaFeedError = feed.errorMessage;
          const mergedActivities = syncedRows.map(syncedRowToStravaFeedActivity);
          stravaSyncedActivityCount = mergedActivities.length;
          const discoverRow = getDiscoverRaceById(raceId);
          if (discoverRow) {
            stravaManualEligibleCount = mergedActivities.filter(
              (a) => !usedStrava.has(a.strava_id) && isStravaManualLinkPoolActivity(a, discoverRow)
            ).length;
          }
          stravaCandidates = rankStravaActivitiesForDiscoverRace(raceId, mergedActivities, usedStrava, {
            forManualLink: true
          });
        }
      } catch {
        userMatch = null;
        bucketFuture = null;
        catalogOwner = false;
        stravaCandidates = [];
        stravaOk = false;
        stravaFeedError = undefined;
        stravaSyncedActivityCount = 0;
        stravaManualEligibleCount = 0;
        publicFinishers = [];
        discoverViewerId = null;
      }
    }

    return (
      <>
        <AppNavbar />
        <section className="hero-full min-h-[320px] md:min-h-[380px]">
          <div className="hero-bg relative">
            <Image
              src={detail.heroImagePath}
              alt=""
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
          </div>
          <div className="hero-overlay" />
          <div className="hero-inner flex min-h-[320px] flex-col justify-end pb-10 md:min-h-[380px]">
            <Link href="/races/find" className="mb-6 w-fit text-[13px] font-medium text-white/80 transition hover:text-white">
              ← Find a race
            </Link>
            <p className="type-eyebrow">Runfolio race library</p>
            <h1 className="type-display mt-3 max-w-4xl">{detail.displayTitle}</h1>
            <p className="type-tagline mt-4 max-w-2xl text-white/85">{detail.location}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="border border-white/25 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                {detail.groupLabel}
              </span>
              <span className="border border-accent/50 bg-accent/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent">
                {surfaceLabel(detail.surface)}
              </span>
              <span className="border border-white/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                {formatDiscoverDistance(detail.distanceKm, detail.multiDay)}
              </span>
              {userMatch ? (
                <span className="border border-green-500/55 bg-green-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-green-300">
                  In your portfolio
                </span>
              ) : bucketFuture ? (
                <span className="border border-amber-500/45 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-200">
                  On your bucket list
                </span>
              ) : null}
            </div>
          </div>
        </section>

        <main className="app-shell space-y-10 pb-16">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="space-y-6">
              <div className="border border-white/10 bg-[#0a0a0a] p-6 md:p-8">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">About this race</h2>
                <p className="mt-4 text-base leading-relaxed text-white/90">{detail.shortDescription}</p>
              </div>
              <div className="border border-gold/30 bg-gradient-to-br from-gold/10 to-black/40 p-6 md:p-8">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold">Why it matters</h2>
                <p className="mt-4 text-sm leading-relaxed text-slate-200">{detail.prestige}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="border border-white/10 bg-[#0d0d0d] p-6">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Key stats</h2>
                <ul className="mt-4 space-y-3">
                  {detail.keyStats.map((row) => (
                    <li key={row.label} className="flex justify-between gap-4 border-b border-white/5 pb-3 text-sm last:border-0">
                      <span className="text-muted">{row.label}</span>
                      <span className="font-semibold text-white">{row.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border border-white/10 bg-[#0d0d0d] p-6">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Your Runfolio</h2>
                <p className="mt-3 text-sm text-slate-300">
                  Add this race as a goal, link a Strava finish, or open your portfolio entry — without juggling multiple
                  flows.
                </p>
                <div className="mt-5">
                  <RaceDiscoverPortfolioActions
                    discoverRaceId={raceId}
                    raceDisplayTitle={detail.displayTitle}
                    discoverLocation={detail.location}
                    isAuthed={catalogOwner}
                    completedRow={userMatch}
                    bucketFutureRow={bucketFuture}
                    stravaCandidates={stravaCandidates}
                    stravaOk={stravaOk}
                    stravaOAuthConfigured={stravaOAuthConfigured}
                    stravaFeedErrorMessage={stravaFeedError}
                    stravaSyncedActivityCount={stravaSyncedActivityCount}
                    stravaManualEligibleCount={stravaManualEligibleCount}
                  />
                </div>
              </div>
            </div>
          </div>

          {userMatch ? (
            <div className="border border-green-500/40 bg-green-950/25 p-6 md:p-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-400">You completed this</p>
              {raceIsBucketListItem(userMatch) ? (
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-gold">
                  Bucket list · completed (was on your list)
                </p>
              ) : (
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-white/60">
                  Confirmed finish · not counted toward bucket list completed (add via bucket first for that badge)
                </p>
              )}
              <p className="mt-3 text-lg font-semibold text-white">
                Logged as <span className="text-accent">{userMatch.name}</span>
                {userMatch.date ? ` · ${userMatch.date}` : null}
              </p>
              {userMatch.description ? (
                <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-white/85">
                  {userMatch.description}
                </p>
              ) : null}
              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted">Distance</dt>
                  <dd className="mt-1 font-semibold text-white">{userMatch.distance_km ?? "—"} km</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted">Time</dt>
                  <dd className="mt-1 font-semibold text-white">{userMatch.time ?? "—"}</dd>
                </div>
                <div className="sm:col-span-3">
                  <dt className="text-[10px] uppercase tracking-wider text-muted">Activity & portfolio</dt>
                  <dd className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                    {userMatch.strava_activity_id ? (
                      <>
                        {parseActivityPageId(userMatch.strava_activity_id)?.kind === "file_import" ? null : (
                          <a
                            href={`https://www.strava.com/activities/${userMatch.strava_activity_id}`}
                            className="font-semibold text-teal hover:text-teal-hover hover:underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open on Strava
                          </a>
                        )}
                        <Link
                          href={`/activities/${encodeURIComponent(userMatch.strava_activity_id)}`}
                          className="font-semibold text-gold hover:underline"
                        >
                          Runfolio activity page →
                        </Link>
                      </>
                    ) : (
                      <span className="text-muted">No activity link — manual or pre-Strava entry</span>
                    )}
                  </dd>
                </div>
              </dl>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={portfolioRaceHref(userMatch)}
                  className="rounded-[12px] border border-border bg-panelAlt px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-slate-800"
                >
                  View race
                </Link>
                {userMatch.strava_activity_id ? (
                  <Link
                    href={`/races/${userMatch.id}/activity`}
                    className="rounded-[12px] border border-white/15 px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted transition hover:border-white/30 hover:text-white"
                  >
                    Classic race page
                  </Link>
                ) : null}
                <Link href="/races/new" className="rounded-[12px] px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted transition hover:text-white">
                  Add reflection / edit
                </Link>
              </div>
              <RaceCatalogPortfolioControls discoverRaceId={raceId} isOwner={catalogOwner} completedRow={userMatch} />
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-4 text-center">
              <p className="type-meta text-sm">
                Haven&apos;t logged this one yet?{" "}
                <Link href={`/races/new?discover=${encodeURIComponent(raceId)}`} className="text-teal hover:text-teal-hover hover:underline">
                  Start from this race template
                </Link>
                .
              </p>
              <RaceCatalogPortfolioControls discoverRaceId={raceId} isOwner={catalogOwner} completedRow={null} />
            </div>
          )}

          <div className="app-shell">
            <RaceCommunityFinishersSection
              heading="Runners who finished this"
              subline={`Public profiles with a published finish linked to ${detail.displayTitle}.`}
              finishers={publicFinishers}
              excludeUserId={discoverViewerId}
            />
          </div>
        </main>
      </>
    );
  }

  const canonRes = await getCachedCanonicalDetailResult(raceId);
  if (!canonRes.ok) {
    return <CanonicalRaceCatalogOffline message={canonRes.error} />;
  }
  if (canonRes.data) {
    const race = canonRes.data;
    let viewer: Awaited<ReturnType<typeof fetchCanonicalRaceViewerState>> | null = null;
    let canonFinishers: PublicRaceFinisher[] = [];
    let canonViewerId: string | null = null;
    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient();
        const [{ user }, finishers] = await Promise.all([
          getServerAuthUser(),
          fetchPublicFinishersForCanonicalRace(supabase, race.id, 40)
        ]);
        canonFinishers = finishers;
        canonViewerId = user?.id ?? null;
        if (user?.id) {
          viewer = await fetchCanonicalRaceViewerState(supabase, user.id, race.id);
        }
      } catch {
        viewer = null;
        canonFinishers = [];
        canonViewerId = null;
      }
    }
    return (
      <>
        <AppNavbar />
        <CanonicalRaceDetailView
          race={race}
          viewer={viewer}
          urlRef={raceId}
          publicFinishers={canonFinishers}
          viewerUserId={canonViewerId}
        />
      </>
    );
  }

  const userRace = await getRaceById(raceId);
  if (!userRace) notFound();
  if (userRace.is_completed) redirect(`/races/${raceId}/activity`);
  redirect(`/races/${raceId}/info`);
}
