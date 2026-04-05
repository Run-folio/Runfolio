import { isDynamicServerError } from "next/dist/client/components/hooks-server-context";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { AppNavbar } from "@/components/app-navbar";
import { BucketListWorkflow } from "@/components/bucket-list-workflow";
import { DataBackendSetupGate } from "@/components/data-backend-setup-gate";
import { getServerAuthUser } from "@/lib/auth-server";
import { usedStravaActivityIdsFromRaces } from "@/lib/catalog-discover-user-state";
import { raceCountsAsBucketListCompleted, raceIsBucketListFutureGoal } from "@/lib/bucket-list-model";
import { fetchCanonicalBucketGoalsForUser } from "@/lib/bucket-list-canonical/queries";
import { discoverRaces } from "@/lib/discover-races";
import { runfolioLog } from "@/lib/runfolio-log";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/demo-mode";
import { requirePersistenceReadyOrRedirect } from "@/lib/require-persistence-ready";
import { getStravaConnectionStubFeed } from "@/lib/strava-feed";
import { listSyncedActivitiesForUser } from "@/lib/strava-sync/repository";
import { syncedRowToStravaFeedActivity } from "@/lib/strava-sync/synced-row-to-feed";
import type { Race } from "@/types";

export const dynamic = "force-dynamic";

export default async function BucketListPage() {
  if (!isSupabaseConfigured()) {
    return (
      <DataBackendSetupGate title="Bucket List" featureLabel="Bucket list goals and Strava links" returnTo="/bucket-list" />
    );
  }

  await requirePersistenceReadyOrRedirect("/bucket-list");

  let races: Race[] = [];
  let canonicalFuture: Awaited<ReturnType<typeof fetchCanonicalBucketGoalsForUser>>["future"] = [];
  let canonicalCompleted: Awaited<ReturnType<typeof fetchCanonicalBucketGoalsForUser>>["completed"] = [];
  let authedUserId: string | null = null;
  try {
    const { user, authError } = await getServerAuthUser();
    if (authError) throw new Error(authError);
    if (!user) redirect("/auth/login");
    authedUserId = user.id;
    const supabase = await createClient();
    const result = await supabase.from("races").select("*").eq("user_id", user.id).order("date", { ascending: false });
    if (result.error) {
      runfolioLog.warn("BucketList.races", result.error.message ?? "query error");
      races = [];
    } else {
      races = result.data ?? [];
    }
    const canon = await fetchCanonicalBucketGoalsForUser(supabase, user.id);
    canonicalFuture = canon.future;
    canonicalCompleted = canon.completed;
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("BucketList.supabase", e);
    throw e;
  }

  const completed = (races ?? []).filter(raceCountsAsBucketListCompleted);
  const future = (races ?? []).filter(raceIsBucketListFutureGoal);

  const stravaOAuthConfigured = Boolean(
    process.env.STRAVA_CLIENT_ID?.trim() && process.env.STRAVA_CLIENT_SECRET?.trim()
  );
  const feed = await getStravaConnectionStubFeed();
  const usedStravaIds = [...usedStravaActivityIdsFromRaces(races ?? [])];
  let stravaActivitiesForUi: ReturnType<typeof syncedRowToStravaFeedActivity>[] = [];
  let stravaMergedCount = 0;
  if (authedUserId) {
    const supabase = await createClient();
    const synced = await listSyncedActivitiesForUser(supabase, authedUserId);
    stravaActivitiesForUi = synced.map(syncedRowToStravaFeedActivity);
    stravaMergedCount = stravaActivitiesForUi.length;
  }

  return (
    <>
      <AppNavbar />
      <main className="app-shell pb-16 pt-4 md:pt-6">
        <BucketListWorkflow
          canonicalFuture={canonicalFuture}
          canonicalCompleted={canonicalCompleted}
          futureGoals={future}
          completedBucketRaces={completed}
          catalogRaces={discoverRaces}
          stravaActivities={stravaActivitiesForUi}
          usedStravaIds={usedStravaIds}
          stravaOk={feed.ok}
          stravaOAuthConfigured={stravaOAuthConfigured}
          stravaFeedErrorMessage={feed.errorMessage}
          stravaSyncedActivityCount={stravaMergedCount}
        />
      </main>
    </>
  );
}
