import { isDynamicServerError } from "next/dist/client/components/hooks-server-context";
import Link from "next/link";
import { AppNavbar } from "@/components/app-navbar";
import { DevMatchDebugSummary } from "@/components/dev-match-debug-summary";
import { ProfileRaceLinkedCelebration } from "@/components/profile-race-linked-celebration";
import { ProfileBucketList } from "@/components/profile-bucket-list";
import { ProfileHero } from "@/components/profile-hero";
import { ProfilePendingRaceCandidates } from "@/components/profile-pending-race-candidates";
import { RunningProfileCompletedGrid } from "@/components/running-profile/running-profile-completed-grid";
import { RunningProfileIdentityForm } from "@/components/running-profile/running-profile-identity-form";
import { RunningProfilePublishQueue } from "@/components/running-profile/running-profile-publish-queue";
import { RunningProfileRecentSyncStrip } from "@/components/running-profile/running-profile-recent-sync-strip";
import { RunningProfileSelectedEfforts } from "@/components/running-profile/running-profile-selected-efforts";
import { RunningProfileSpotlight } from "@/components/running-profile/running-profile-spotlight";
import { RunningProfileRaceIdentitySection } from "@/components/running-profile/running-profile-race-identity";
import { RunningProfileStatsRow } from "@/components/running-profile/running-profile-stats-row";
import { ensurePublicUserRowForAuthedRequest } from "@/lib/auth-ensure-public-user-on-request";
import { getServerAuthUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/demo-mode";
import { fetchCanonicalBucketGoalsForUser } from "@/lib/bucket-list-canonical/queries";
import { raceCountsAsBucketListCompleted, raceIsBucketListFutureGoal } from "@/lib/bucket-list-model";
import {
  buildRunnerIdentityPresentation,
  deriveRunnerAchievements,
  deriveRunnerRaceIdentity
} from "@/lib/race-identity/derive";
import { loadDevMatchDebugSnapshot } from "@/lib/dev-match-debug-snapshot";
import { buildProfilePendingRaceCandidates } from "@/lib/profile-pending-candidates";
import { profileApprovedCompletedRaces } from "@/lib/portfolio-race";
import { resolveProfileHeroPhoto } from "@/lib/profile-hero-asset";
import { computeRunningProfileStats } from "@/lib/running-profile/stats";
import { runfolioLog } from "@/lib/runfolio-log";
import {
  listProfileIncludedSyncedActivities,
  listSyncedActivitiesForUser
} from "@/lib/strava-sync/repository";
import { fetchProfileBundleByUserId, fetchPublicProfileBundle } from "@/lib/supabase/fetch-public-profile";
import { getStravaConnectionStubFeed } from "@/lib/strava-feed";
import {
  computeStravaFeedStats,
  dedupeHighConfidenceDiscoverIds,
  enrichRaceCandidatesWithCatalogMatches,
  filterStravaRaceCandidates
} from "@/lib/strava-race-candidates";
import { syncedRowToStravaFeedActivity } from "@/lib/strava-sync/synced-row-to-feed";
import type { ProfilePendingRaceCandidate, Race, StravaFeedStats, StravaRaceCandidate } from "@/types";
import type { StravaSyncedActivityRow } from "@/lib/strava-sync/types";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ username: string }>;
};

export default async function PublicProfilePage({ params }: Props) {
  const profileHeroPhoto = resolveProfileHeroPhoto();
  const { username } = await params;
  const profilePath = `/${username}`;

  let runner: Awaited<ReturnType<typeof fetchPublicProfileBundle>>["runner"] = null;
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
  let pinnedSynced: StravaSyncedActivityRow[] = [];
  let recentSynced: StravaSyncedActivityRow[] = [];
  let profileAuthUser: Awaited<ReturnType<typeof getServerAuthUser>>["user"] = null;
  let devMatchDebug: Awaited<ReturnType<typeof loadDevMatchDebugSnapshot>> | null = null;

  if (!isSupabaseConfigured()) {
    runner = {
      id: "offline",
      name: decodeURIComponent(username),
      profile_location: null,
      profile_tagline: null,
      profile_public: true
    };
    allRaces = [];
  } else {
    try {
      const authRes = await getServerAuthUser();
      profileAuthUser = authRes.user ?? null;
      if (profileAuthUser) {
        const supabaseForUser = await createClient();
        await ensurePublicUserRowForAuthedRequest(supabaseForUser, profileAuthUser);
      }

      let bundle = await fetchPublicProfileBundle(username);
      if (!bundle.runner && profileAuthUser) {
        const byId = await fetchProfileBundleByUserId(profileAuthUser.id);
        if (byId.runner?.id === profileAuthUser.id) {
          bundle = byId;
        }
      }
      runner = bundle.runner;
      allRaces = bundle.races ?? [];

      isOwnProfile = Boolean(profileAuthUser?.id && runner && profileAuthUser.id === runner.id);

      if (isOwnProfile && profileAuthUser && runner) {
        const supabase = await createClient();
        const { data: dis, error: disErr } = await supabase
          .from("strava_profile_dismissals")
          .select("strava_activity_id")
          .eq("user_id", profileAuthUser.id);
        const dismissedIds =
          disErr || !dis ? new Set<string>() : new Set(dis.map((d) => d.strava_activity_id));

        const feed = await getStravaConnectionStubFeed();
        const syncedForStrip = (await listSyncedActivitiesForUser(supabase, profileAuthUser.id)).filter(
          (r) => !r.manual_link_only && r.potential_race_activity
        );
        const stripActs = filterStravaRaceCandidates(syncedForStrip.map(syncedRowToStravaFeedActivity));
        stravaEnriched = enrichRaceCandidatesWithCatalogMatches(stripActs, allRaces ?? []);
        ownProfileStrava = {
          raceCandidates: stravaEnriched,
          raceCandidateStats: computeStravaFeedStats(stripActs),
          matchedMajorDiscoverIds: dedupeHighConfidenceDiscoverIds(stravaEnriched),
          stravaOk: feed.ok || stripActs.length > 0
        };
        pendingCandidates = buildProfilePendingRaceCandidates(stravaEnriched, allRaces, dismissedIds);
        const canon = await fetchCanonicalBucketGoalsForUser(supabase, profileAuthUser.id);
        canonicalFuture = canon.future;
        canonicalCompleted = canon.completed;

        try {
          pinnedSynced = await listProfileIncludedSyncedActivities(supabase, profileAuthUser.id);
          recentSynced = (await listSyncedActivitiesForUser(supabase, profileAuthUser.id)).slice(0, 12);
        } catch (syncErr) {
          runfolioLog.warn(
            "PublicProfile.syncedActivities",
            syncErr instanceof Error ? syncErr.message : "failed"
          );
        }
        if (process.env.NODE_ENV === "development") {
          devMatchDebug = await loadDevMatchDebugSnapshot(
            supabase,
            profileAuthUser.id,
            profileAuthUser,
            { page: "profile", profileSlugFromUrl: username },
            { portfolioRaces: allRaces }
          );
        }
      }
    } catch (e) {
      if (isDynamicServerError(e)) throw e;
      runfolioLog.error("PublicProfile.supabase", e, { username });
      runner = null;
      allRaces = [];
      pendingCandidates = [];
    }
  }

  if (!runner) {
    return (
      <>
        <AppNavbar />
        <main className="min-h-screen bg-[#05070c] px-6 py-20 text-center">
          <h1 className="font-display text-2xl text-white">
            {profileAuthUser ? "We couldn’t open this profile URL" : "Runner not found"}
          </h1>
          <p className="type-meta mx-auto mt-3 max-w-md text-sm text-white/55">
            {profileAuthUser ? (
              <>
                Public lookup uses the name on your Runfolio account. Open{" "}
                <Link href="/dashboard" className="font-semibold text-accent underline-offset-4 hover:underline">
                  Overview
                </Link>{" "}
                to sync your display name with your profile link, or check the spelling in the address bar.
              </>
            ) : (
              <>Check the URL or discover races on Runfolio.</>
            )}
          </p>
        </main>
      </>
    );
  }

  const displayName = runner.name ?? decodeURIComponent(username);
  const profilePublic = runner.profile_public !== false;

  if (!profilePublic && !isOwnProfile) {
    return (
      <>
        <AppNavbar />
        <main className="min-h-screen bg-[#05070c] px-6 py-24 text-center">
          <h1 className="font-display text-2xl text-white">This profile is private</h1>
          <p className="type-meta mt-3 max-w-md mx-auto text-sm text-white/55">
            The runner has chosen to hide their public portfolio.
          </p>
        </main>
      </>
    );
  }

  const future = (allRaces ?? []).filter((r) => !r.is_completed);
  const profileApproved = profileApprovedCompletedRaces(allRaces ?? []).sort((a, b) =>
    String(b.date ?? "").localeCompare(String(a.date ?? ""))
  );
  const stats = computeRunningProfileStats(profileApproved);

  const spotlightRaces = profileApproved.filter((r) => r.profile_featured || r.tag_career_highlight);
  const spotlightIds = new Set(spotlightRaces.map((r) => r.id));
  const gridRaces =
    spotlightRaces.length > 0 ? profileApproved.filter((r) => !spotlightIds.has(r.id)) : profileApproved;

  const runnerIdentity = deriveRunnerRaceIdentity(profileApproved);
  const runnerAchievements = deriveRunnerAchievements(profileApproved, runnerIdentity);
  const runnerPresentation = buildRunnerIdentityPresentation(runnerIdentity);

  return (
    <>
      <AppNavbar />
      <main className="min-h-screen bg-[#05070c]">
        <ProfileRaceLinkedCelebration enabled={isOwnProfile} />
        <ProfileHero
          displayName={displayName}
          imageSrc={profileHeroPhoto}
          tagline={runner.profile_tagline}
          location={runner.profile_location}
          footer={<RunningProfileStatsRow stats={stats} />}
        />

        <div className="mx-auto w-full max-w-[1400px] px-0">
          {!profilePublic && isOwnProfile ? (
            <div className="border-x border-b border-amber-500/25 bg-amber-950/20 px-5 py-4 text-center text-sm text-amber-100/90 md:px-8">
              Your profile is hidden from visitors. Turn visibility on below when you&apos;re ready.
            </div>
          ) : null}

          {isOwnProfile ? (
            <div className="border-x border-b border-border bg-[#080a0e] px-5 py-6 md:px-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Identity</p>
              <RunningProfileIdentityForm
                initialTagline={runner.profile_tagline ?? ""}
                initialLocation={runner.profile_location ?? ""}
                initialPublic={profilePublic}
              />
            </div>
          ) : null}

          {isOwnProfile && pendingCandidates.length > 0 ? (
            <ProfilePendingRaceCandidates candidates={pendingCandidates} profilePath={profilePath} />
          ) : null}

          {isOwnProfile ? <RunningProfilePublishQueue allRaces={allRaces ?? []} /> : null}

          <RunningProfileRaceIdentitySection
            presentation={runnerPresentation}
            identity={runnerIdentity}
            achievements={runnerAchievements}
            showWhenEmpty={isOwnProfile}
          />

          <RunningProfileSpotlight races={profileApproved} isOwner={isOwnProfile} />

          {gridRaces.length > 0 || spotlightRaces.length === 0 ? (
            <RunningProfileCompletedGrid races={gridRaces} isOwner={isOwnProfile} />
          ) : (
            <section
              id="profile-completed-races"
              tabIndex={-1}
              className="scroll-mt-24 border-x border-b border-border bg-[#07080d] px-5 py-8 text-center md:px-8"
            >
              <p className="type-meta text-sm text-white/50">
                Every published finish is in your spotlight above — add another race or turn off &ldquo;Feature&rdquo; on
                one finish to build the longer gallery below.
              </p>
            </section>
          )}

          <RunningProfileSelectedEfforts activities={pinnedSynced} isOwner={isOwnProfile} />
          {isOwnProfile ? <RunningProfileRecentSyncStrip rows={recentSynced} /> : null}

          {ownProfileStrava && stravaOAuthConfigured ? (
            <p className="border-x border-b border-border bg-[#07080d] px-5 py-4 text-center text-[11px] text-white/45 md:px-8">
              Strava long-run review and smart matches live on the{" "}
              <Link href="/dashboard" className="text-gold hover:text-white">
                dashboard
              </Link>
              .
            </p>
          ) : null}

          <div className="grid gap-0 border-x border-border lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <div className="hidden border-b border-border lg:block" aria-hidden />
            <ProfileBucketList
              completed={(allRaces ?? []).filter(raceCountsAsBucketListCompleted)}
              future={future.filter(raceIsBucketListFutureGoal)}
              canonicalFuture={isOwnProfile ? canonicalFuture : []}
              canonicalCompleted={isOwnProfile ? canonicalCompleted : []}
            />
          </div>
        </div>
      </main>
      {devMatchDebug ? <DevMatchDebugSummary snapshot={devMatchDebug} /> : null}
    </>
  );
}
