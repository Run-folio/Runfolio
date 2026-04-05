import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AppNavbar } from "@/components/app-navbar";
import { DataBackendSetupGate } from "@/components/data-backend-setup-gate";
import { DevMatchDebugSummary } from "@/components/dev-match-debug-summary";
import { MyRacesActionStrip } from "@/components/my-races/my-races-action-strip";
import { MyRacesClient } from "@/components/my-races/my-races-client";
import { StravaBackfillExperience } from "@/components/strava-backfill-experience";
import { StravaOAuthResultBanner } from "@/components/strava-oauth-result-banner";
import { ensurePublicUserRowForAuthedRequest } from "@/lib/auth-ensure-public-user-on-request";
import { getServerAuthUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/demo-mode";
import { loadDevMatchDebugSnapshot } from "@/lib/dev-match-debug-snapshot";
import { loadMatchHubBundle } from "@/lib/match-hub/service";
import { loadStravaBackfillProgress } from "@/lib/strava-backfill-progress";
import { loadUserStravaOverviewState } from "@/lib/strava-user-overview";
import { OVERVIEW_PATH } from "@/lib/app-paths";
import { resolveDefaultProfilePathForUser, resolveProfileHrefForSignedInNav } from "@/lib/profile-path-server";
import { buildSetupUrl } from "@/lib/setup-url";
import { requirePersistenceReadyOrRedirect } from "@/lib/require-persistence-ready";
import { buildProfilePendingRaceCandidates } from "@/lib/profile-pending-candidates";
import {
  filterStravaRaceCandidates,
  enrichRaceCandidatesWithCatalogMatches
} from "@/lib/strava-race-candidates";
import { listSyncedActivitiesForUser } from "@/lib/strava-sync/repository";
import { syncedRowToStravaFeedActivity } from "@/lib/strava-sync/synced-row-to-feed";
import type { ProfilePendingRaceCandidate, Race } from "@/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Races · Runfolio",
  description: "Import runs from Strava, match finishes to the catalog, and manage linked races."
};

type PageProps = { searchParams: Promise<{ tab?: string }> };

export default async function MyRacesPage({ searchParams }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <DataBackendSetupGate title="My Races" featureLabel="My Races" returnTo="/my-races" />;
  }

  await requirePersistenceReadyOrRedirect("/my-races");

  const sp = await searchParams;
  const initialTab = sp.tab === "review" ? "review" : "completed";

  const { user, authError } = await getServerAuthUser();
  if (authError || !user) {
    redirect(`/auth/login?next=${encodeURIComponent("/my-races")}`);
  }

  const supabase = await createClient();
  await ensurePublicUserRowForAuthedRequest(supabase, user);
  const { data: racesRes } = await supabase.from("races").select("*").eq("user_id", user.id);
  const portfolioRaces = (racesRes ?? []) as Race[];

  const stravaOverview = await loadUserStravaOverviewState(supabase, user.id);
  const bundle = await loadMatchHubBundle(supabase, user.id, portfolioRaces, {
    syncedRows: stravaOverview.syncedRows,
    collectDevCanonicalTraces: process.env.NODE_ENV === "development"
  });

  const { data: profileDismissals, error: profileDisErr } = await supabase
    .from("strava_profile_dismissals")
    .select("strava_activity_id")
    .eq("user_id", user.id);
  const dismissedProfileIds =
    profileDisErr || !profileDismissals
      ? new Set<string>()
      : new Set(profileDismissals.map((d) => d.strava_activity_id));

  const syncedForCatalogPending = (await listSyncedActivitiesForUser(supabase, user.id)).filter(
    (r) => !r.manual_link_only && r.potential_race_activity
  );
  const stripActs = filterStravaRaceCandidates(syncedForCatalogPending.map(syncedRowToStravaFeedActivity));
  const stravaEnrichedCatalog = enrichRaceCandidatesWithCatalogMatches(stripActs, portfolioRaces);
  const profilePendingCandidates: ProfilePendingRaceCandidate[] = buildProfilePendingRaceCandidates(
    stravaEnrichedCatalog,
    portfolioRaces,
    dismissedProfileIds
  );

  const profilePath = await resolveDefaultProfilePathForUser(supabase, user.id);
  const profileHref = await resolveProfileHrefForSignedInNav(supabase, user.id, {
    authDisplayName: typeof user.user_metadata?.name === "string" ? user.user_metadata.name : null,
    emailLocalPart: user.email?.split("@")[0] ?? null
  });
  const completedRacesHref =
    profilePath !== OVERVIEW_PATH ? `${profilePath}#profile-completed-races` : OVERVIEW_PATH;

  const stravaOAuthConfigured = Boolean(
    process.env.STRAVA_CLIENT_ID?.trim() && process.env.STRAVA_CLIENT_SECRET?.trim()
  );

  const backfillProgress = await loadStravaBackfillProgress(supabase, user.id);

  const devMatchDebug =
    process.env.NODE_ENV === "development"
      ? await loadDevMatchDebugSnapshot(
          supabase,
          user.id,
          user,
          {
            page: "my-races",
            profileSlugFromUrl: profilePath !== OVERVIEW_PATH ? profilePath.replace(/^\//, "") : undefined
          },
          { portfolioRaces, stravaOverview, bundle }
        )
      : null;

  return (
    <>
      <AppNavbar />
      <main className="min-h-screen bg-[#05070c] pb-24">
        <div className="app-shell mx-auto w-full max-w-5xl px-4 pt-6 pb-4 md:px-6 md:pt-10">
          <StravaOAuthResultBanner />
          <header className="mb-4 md:mb-6">
            <h1 className="font-display text-2xl font-normal tracking-tight text-white md:text-3xl">My Races</h1>
          </header>

          <MyRacesActionStrip stravaOAuthConfigured={stravaOAuthConfigured} />

          {!stravaOAuthConfigured && bundle.totalSyncedCount === 0 ? (
            <p className="mb-6 text-sm text-white/55">
              <Link href={buildSetupUrl("/my-races")} className="font-semibold text-teal underline-offset-4 hover:text-teal-hover hover:underline">
                Setup
              </Link>{" "}
              Strava, or add races from Find / Add race.
            </p>
          ) : null}

          <section id="import-strava" className="scroll-mt-24">
            <StravaBackfillExperience
              initialProgress={backfillProgress}
              stravaOAuthConfigured={stravaOAuthConfigured}
              compact
            />
          </section>
        </div>

        <div className="app-shell mx-auto max-w-5xl px-4 pb-10 md:px-6">
          <MyRacesClient
            initialBundle={bundle}
            portfolioRaces={portfolioRaces}
            profileHref={profileHref}
            completedRacesHref={completedRacesHref}
            stravaOAuthConfigured={stravaOAuthConfigured}
            initialTab={initialTab}
            profilePendingCandidates={profilePendingCandidates}
            pendingReviewReturnTo="/my-races?tab=review"
          />
        </div>
      </main>
      {devMatchDebug ? <DevMatchDebugSummary snapshot={devMatchDebug} /> : null}
    </>
  );
}
