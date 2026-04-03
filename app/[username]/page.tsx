import { isDynamicServerError } from "next/dist/client/components/hooks-server-context";
import { AppNavbar } from "@/components/app-navbar";
import { ProfileBucketList } from "@/components/profile-bucket-list";
import { ProfileHero } from "@/components/profile-hero";
import { ProfileMediumMatchStrip } from "@/components/profile-medium-match-strip";
import { ProfileTopRaces } from "@/components/profile-top-races";
import { RaceJourney } from "@/components/race-journey";
import { StravaProfileBlock } from "@/components/strava-profile-block";
import { getServerAuthUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/demo-mode";
import { extractMediumStravaMatchesForProfile } from "@/lib/profile-portfolio";
import { confirmedCompletedPortfolioRaces } from "@/lib/portfolio-race";
import { raceCountsAsBucketListCompleted, raceIsBucketListFutureGoal } from "@/lib/bucket-list-model";
import { resolveProfileHeroPhoto } from "@/lib/profile-hero-asset";
import { runfolioLog } from "@/lib/runfolio-log";
import { getStravaFeed } from "@/lib/strava-feed";
import { dedupeHighConfidenceDiscoverIds, enrichRaceCandidatesWithCatalogMatches } from "@/lib/strava-race-candidates";
import type { Race, StravaFeedStats, StravaRaceCandidate } from "@/types";

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

  if (!isSupabaseConfigured()) {
    runner = { id: "offline", name: decodeURIComponent(username) };
    allRaces = [];
  } else {
    try {
      const supabase = await createClient();
      const userResult = await supabase.from("users").select("*").eq("name", username).single();
      if (userResult.error && userResult.error.code !== "PGRST116") {
        throw new Error(userResult.error.message);
      }
      runner = userResult.data;
      if (runner) {
        const racesResult = await supabase
          .from("races")
          .select("*")
          .eq("user_id", runner.id)
          .order("date", { ascending: false });
        if (racesResult.error) throw new Error(racesResult.error.message);
        allRaces = racesResult.data ?? [];
      } else {
        allRaces = [];
      }

      const { user } = await getServerAuthUser();
      isOwnProfile = Boolean(user?.id && runner && user.id === runner.id);

      if (isOwnProfile) {
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
      }
    } catch (e) {
      if (isDynamicServerError(e)) throw e;
      runfolioLog.error("PublicProfile.supabase", e, { username });
      runner = null;
      allRaces = [];
    }
  }

  const future = (allRaces ?? []).filter((r) => !r.is_completed);
  /** Top Races + Race Journey: confirmed catalog/Strava finishes only. */
  const profileCompleted = confirmedCompletedPortfolioRaces(allRaces ?? []);

  const mediumMatches =
    isOwnProfile && stravaEnriched.length > 0 ? extractMediumStravaMatchesForProfile(stravaEnriched) : [];

  const displayName = runner?.name ?? decodeURIComponent(username);

  return (
    <>
      <AppNavbar />
      <main className="min-h-screen bg-[#05070c]">
        <ProfileHero key={profileHeroPhoto} displayName={displayName} imageSrc={profileHeroPhoto} />

        <div className="mx-auto w-full max-w-[1400px] px-0">
          <ProfileTopRaces completedRaces={profileCompleted} />

          {mediumMatches.length > 0 ? <ProfileMediumMatchStrip matches={mediumMatches} profilePath={profilePath} /> : null}

          {ownProfileStrava ? (
            <StravaProfileBlock
              raceCandidates={ownProfileStrava.raceCandidates}
              raceCandidateStats={ownProfileStrava.raceCandidateStats}
              matchedMajorDiscoverIds={ownProfileStrava.matchedMajorDiscoverIds}
              stravaOAuthConfigured={stravaOAuthConfigured}
              stravaOk={ownProfileStrava.stravaOk}
            />
          ) : null}

          <div className="grid gap-0 border-x border-border lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <RaceJourney races={profileCompleted} />
            <ProfileBucketList
              completed={(allRaces ?? []).filter(raceCountsAsBucketListCompleted)}
              future={future.filter(raceIsBucketListFutureGoal)}
            />
          </div>
        </div>
      </main>
    </>
  );
}
