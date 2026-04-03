import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppNavbar } from "@/components/app-navbar";
import { ActivityPortfolioClient } from "@/components/activity-portfolio-client";
import { DataBackendSetupGate } from "@/components/data-backend-setup-gate";
import type { LinkedStravaActivitySnapshot } from "@/lib/linked-activity-snapshot";
import {
  buildActivityPortfolioStravaView,
  buildActivityPortfolioStravaViewFromRace,
  buildActivityPortfolioStravaViewFromSnapshot
} from "@/lib/activity-portfolio-strava";
import { getCatalogDisplayTitle } from "@/lib/discover-race-details";
import { getRaceByStravaActivityId } from "@/lib/get-race-by-strava-activity";
import { RACE_MATCH_HIGH_SCORE, rankKnownRaceMatches } from "@/lib/known-race-match";
import { getServerAuthUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/demo-mode";
import { requirePersistenceReadyOrRedirect } from "@/lib/require-persistence-ready";
import { fetchStravaActivityWithRecovery } from "@/lib/strava-resolve-access";
import { parseStravaActivityId } from "@/lib/strava-api";
import { buildManualRaceSoftHints, type ManualRaceSoftHint } from "@/lib/match-hub/manual-link-hints";
import { rankCanonicalMatchesForSyncedRowDetailed } from "@/lib/strava-canonical-match/suggestions";
import type { StravaSyncedActivityRow } from "@/lib/strava-sync/types";
import type { ActivityMatchInput } from "@/types";
import type { Race } from "@/types";

type Props = { params: Promise<{ activityId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { activityId } = await params;
  const id = parseStravaActivityId(activityId);
  if (!id) return { title: "Activity · Runfolio" };
  return { title: `Activity ${id} · Runfolio` };
}

export default async function ActivityPortfolioPage({ params }: Props) {
  const { activityId } = await params;
  const stravaId = parseStravaActivityId(activityId);
  if (!stravaId) notFound();

  if (!isSupabaseConfigured()) {
    return (
      <DataBackendSetupGate
        title="Race activity"
        featureLabel="Saving finishes and catalog links"
        returnTo={`/activities/${stravaId}`}
      />
    );
  }

  await requirePersistenceReadyOrRedirect(`/activities/${stravaId}`);

  const { user, authError } = await getServerAuthUser();
  if (authError || !user) {
    redirect(`/auth/login?next=${encodeURIComponent(`/activities/${stravaId}`)}`);
  }

  const race = await getRaceByStravaActivityId(stravaId, user.id);
  const snap = race?.linked_activity_snapshot as LinkedStravaActivitySnapshot | null | undefined;

  let stravaFetchFailed = false;
  let stravaView = null as ReturnType<typeof buildActivityPortfolioStravaView> | null;

  if (snap && String(snap.strava_activity_id) === stravaId) {
    stravaView = buildActivityPortfolioStravaViewFromSnapshot(snap);
  } else {
    try {
      const { activity } = await fetchStravaActivityWithRecovery(stravaId);
      stravaView = buildActivityPortfolioStravaView(stravaId, activity);
    } catch {
      stravaFetchFailed = true;
      if (race) {
        stravaView = buildActivityPortfolioStravaViewFromRace(race, stravaId);
      }
    }
  }

  if (!stravaView) {
    redirect(
      `/races/new?strava_error=${encodeURIComponent("Could not load this Strava activity. Connect Strava or check the activity ID.")}`
    );
  }

  const supabase = await createClient();
  const { data: userRaces } = await supabase.from("races").select("*").eq("user_id", user.id);
  const allRaces = (userRaces ?? []) as Race[];

  const matchInput: ActivityMatchInput = {
    strava_id: stravaView.strava_id,
    name: stravaView.name,
    distance_km: stravaView.distance_km,
    date: stravaView.start_date,
    elevation_m: stravaView.elevation_m,
    location_city: null,
    location_country: null,
    sport_type: stravaView.sport_type,
    type: stravaView.type
  };
  const ranked = rankKnownRaceMatches(matchInput, allRaces, 0.28);
  const topDiscover = ranked[0];
  const autoDiscoverId =
    topDiscover && topDiscover.score >= RACE_MATCH_HIGH_SCORE && topDiscover.confidence === "high"
      ? topDiscover.discoverRaceId
      : null;
  const suggestedDiscoverRaceId = race?.discover_race_id ?? autoDiscoverId ?? null;
  const catalogDisplayTitle = suggestedDiscoverRaceId ? getCatalogDisplayTitle(suggestedDiscoverRaceId) : null;
  const bucketListGoalActive = Boolean(
    suggestedDiscoverRaceId &&
      allRaces.some((r) => r.discover_race_id === suggestedDiscoverRaceId && !r.is_completed)
  );

  const { data: syncRowRaw } = await supabase
    .from("strava_synced_activities")
    .select("*")
    .eq("user_id", user.id)
    .eq("strava_activity_id", stravaId)
    .maybeSingle();

  let manualLinkSoftHints: ManualRaceSoftHint[] = [];
  if (syncRowRaw) {
    const { ranked } = await rankCanonicalMatchesForSyncedRowDetailed(syncRowRaw as StravaSyncedActivityRow);
    manualLinkSoftHints = buildManualRaceSoftHints(ranked);
  }

  let canonicalRaceSlug: string | null = null;
  if (race?.canonical_race_id) {
    const { data: cr } = await supabase.from("canonical_races").select("slug").eq("id", race.canonical_race_id).maybeSingle();
    canonicalRaceSlug = (cr as { slug?: string } | null)?.slug?.trim() ?? null;
  }

  return (
    <>
      <AppNavbar />
      <ActivityPortfolioClient
        stravaView={stravaView}
        race={race}
        suggestedDiscoverRaceId={suggestedDiscoverRaceId}
        catalogDisplayTitle={catalogDisplayTitle}
        stravaFetchFailed={stravaFetchFailed}
        bucketListGoalActive={bucketListGoalActive}
        manualLinkSoftHints={manualLinkSoftHints}
        canonicalRaceSlug={canonicalRaceSlug}
      />
    </>
  );
}
