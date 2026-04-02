import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppNavbar } from "@/components/app-navbar";
import { ActivityPortfolioClient } from "@/components/activity-portfolio-client";
import {
  buildActivityPortfolioStravaView,
  buildActivityPortfolioStravaViewFromRace
} from "@/lib/activity-portfolio-strava";
import { getCatalogDisplayTitle } from "@/lib/discover-race-details";
import { getRaceByStravaActivityId } from "@/lib/get-race-by-strava-activity";
import { rankKnownRaceMatches } from "@/lib/known-race-match";
import { getServerAuthUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/demo-mode";
import { fetchStravaActivityWithRecovery } from "@/lib/strava-resolve-access";
import { parseStravaActivityId } from "@/lib/strava-api";
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
    redirect("/dashboard");
  }

  const { user, authError } = await getServerAuthUser();
  if (authError || !user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(`/activities/${stravaId}`)}`);
  }

  const race = await getRaceByStravaActivityId(stravaId, user.id);

  let stravaFetchFailed = false;
  let stravaView = null as ReturnType<typeof buildActivityPortfolioStravaView> | null;

  try {
    const { activity } = await fetchStravaActivityWithRecovery(stravaId);
    stravaView = buildActivityPortfolioStravaView(stravaId, activity);
  } catch {
    stravaFetchFailed = true;
    if (race) {
      stravaView = buildActivityPortfolioStravaViewFromRace(race, stravaId);
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
  const suggestedDiscoverRaceId = race?.discover_race_id ?? ranked[0]?.discoverRaceId ?? null;
  const catalogDisplayTitle = suggestedDiscoverRaceId ? getCatalogDisplayTitle(suggestedDiscoverRaceId) : null;
  const bucketListGoalActive = Boolean(
    suggestedDiscoverRaceId &&
      allRaces.some((r) => r.discover_race_id === suggestedDiscoverRaceId && !r.is_completed)
  );

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
      />
    </>
  );
}
