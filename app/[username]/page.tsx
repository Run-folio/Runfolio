import { isDynamicServerError } from "next/dist/client/components/hooks-server-context";
import { AppNavbar } from "@/components/app-navbar";
import { ProfileBucketList } from "@/components/profile-bucket-list";
import { ProfileConfirmedMajorRaces } from "@/components/profile-confirmed-major-races";
import { ProfileHero } from "@/components/profile-hero";
import { ProfilePendingRaceCandidates } from "@/components/profile-pending-race-candidates";
import { ProfileTopRaces } from "@/components/profile-top-races";
import { RaceJourney } from "@/components/race-journey";
import { StravaProfileBlock } from "@/components/strava-profile-block";
import { getServerAuthUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/demo-mode";
import { buildProfilePendingRaceCandidates } from "@/lib/profile-pending-candidates";
import { profileApprovedCompletedRaces } from "@/lib/portfolio-race";
import { fetchCanonicalBucketGoalsForUser } from "@/lib/bucket-list-canonical/queries";
import { raceCountsAsBucketListCompleted, raceIsBucketListFutureGoal } from "@/lib/bucket-list-model";
import { resolveProfileHeroPhoto } from "@/lib/profile-hero-asset";
import { runfolioLog } from "@/lib/runfolio-log";
import { fetchPublicProfileBundle } from "@/lib/supabase/fetch-public-profile";
import { getStravaFeed } from "@/lib/strava-feed";
import { rankRacesForProfileTopRaces } from "@/lib/top-race-rank";
import { dedupeHighConfidenceDiscoverIds, enrichRaceCandidatesWithCatalogMatches } from "@/lib/strava-race-candidates";
import type { ProfilePendingRaceCandidate, Race, StravaFeedStats, StravaRaceCandidate } from "@/types";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ username: string }>;
};

export default async function PublicProfilePage({ params }: Props) {
  const profileHeroPhoto = resolveProfileHeroPhoto();
  const { username } = await params;
  const profilePath = `/${username}`;

  let runner: { id: string; name: string } | null = null;
  let allRaces: Race[] = [];
  const stravaOAuthConfigured = Boolean(
    process.env.STRAVA_CLIENT_ID?.trim() && process.env.STRAVA_CLIENT_SECRET?.trim()
  );
  let ownProfileStrava: {
    raceCandidates: StravaRaceCandidate[];
    raceCandidateStats: StravaFeedStats;
    matchedMajorDiscoverIds: string[];
    stravaOk: boolean;
  } | null = null;
  let isOwnProfile = false;
  let stravaEnriched: StravaRaceCandidate[] = [];
  let pendingCandidates: ProfilePendingRaceCandidate[] = [];
  let canonicalFuture: Awaited<ReturnType<typeof fetchCanonicalBucketGoalsForUser>>["future"] = [];
  let canonicalCompleted: Awaited<ReturnType<typeof fetchCanonicalBucketGoalsForUser>>["completed"] = [];

  if (!isSupabaseConfigured()) {
    runner = { id: "offline", name: decodeURIComponent(username) };
    allRaces = [];
  } else {
    try {
      const bundle = await fetchPublicProfileBundle(username);
      runner = bundle.runner;
      allRaces = bundle.races ?? [];

      const { user } = await getServerAuthUser();
      isOwnProfile = Boolean(user?.id && runner && user.id === runner.id);

      if (isOwnProfile && user && runner) {
        const supabase = await createClient();
        const { data: dis, error: disErr } = await supabase
          .from("strava_profile_dismissals")
          .select("strava_activity_id")
          .eq("user_id", user.id);
        const dismissedIds =
          disErr || !dis ? new Set<string>() : new Set(dis.map((d) => d.strava_activity_id));

        const feed = await getStravaFeed();
        stravaEnriched = feed.ok
          ? enrichRaceCandidatesWithCatalogMatches(feed.raceCandidates, allRaces ?? [])
          : [];
        ownProfileStrava = {
          raceCandidates: stravaEnriched,
          raceCandidateStats: feed.raceCandidateStats,
          matchedMajorDiscoverIds: dedupeHighConfidenceDiscoverIds(stravaEnriched),
          stravaOk: feed.ok
        };
        pendingCandidates = buildProfilePendingRaceCandidates(stravaEnriched, allRaces, dismissedIds);
        const canon = await fetchCanonicalBucketGoalsForUser(supabase, user.id);
        canonicalFuture = canon.future;
        canonicalCompleted = canon.completed;
      }
    } catch (e) {
      if (isDynamicServerError(e)) throw e;
      runfolioLog.error("PublicProfile.supabase", e, { username });
      runner = null;
      allRaces = [];
      pendingCandidates = [];
    }
  }

  const future = (allRaces ?? []).filter((r) => !r.is_completed);
  /** Top Races + Race Journey: user-approved portfolio finishes only. */
  const profileApproved = profileApprovedCompletedRaces(allRaces ?? []).sort((a, b) =>
    String(b.date ?? "").localeCompare(String(a.date ?? ""))
  );

  const ranked = rankRacesForProfileTopRaces(profileApproved);
  const topThreeIds = new Set(ranked.slice(0, 3).map((x) => x.race.id));
  const confirmedMajorRest = profileApproved.filter((r) => !topThreeIds.has(r.id));

  const displayName = runner?.name ?? decodeURIComponent(username);

  return (
    <>
      <AppNavbar />
      <main className="min-h-screen bg-[#05070c]">
        <ProfileHero key={profileHeroPhoto} displayName={displayName} imageSrc={profileHeroPhoto} />

        <div className="mx-auto w-full max-w-[1400px] px-0">
          {isOwnProfile && pendingCandidates.length > 0 ? (
            <ProfilePendingRaceCandidates candidates={pendingCandidates} profilePath={profilePath} />
          ) : null}

          <ProfileTopRaces completedRaces={profileApproved} />

          <ProfileConfirmedMajorRaces races={confirmedMajorRest} />

          {ownProfileStrava ? (
            <StravaProfileBlock
              raceCandidates={ownProfileStrava.raceCandidates}
              raceCandidateStats={ownProfileStrava.raceCandidateStats}
              matchedMajorDiscoverIds={ownProfileStrava.matchedMajorDiscoverIds}
              stravaOAuthConfigured={stravaOAuthConfigured}
              stravaOk={ownProfileStrava.stravaOk}
              profileCurationMode
            />
          ) : null}

          <div className="grid gap-0 border-x border-border lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <RaceJourney races={profileApproved} />
            <ProfileBucketList
              completed={(allRaces ?? []).filter(raceCountsAsBucketListCompleted)}
              future={future.filter(raceIsBucketListFutureGoal)}
              canonicalFuture={isOwnProfile ? canonicalFuture : []}
              canonicalCompleted={isOwnProfile ? canonicalCompleted : []}
            />
          </div>
        </div>
      </main>
    </>
  );
}
