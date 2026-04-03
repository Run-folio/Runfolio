import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalBucketGoalView, BucketListGoalStatus, UserBucketListGoalRow } from "@/lib/bucket-list-canonical/types";
import { runfolioLog } from "@/lib/runfolio-log";

type CanonicalRaceDbRow = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  region: string | null;
  country: string | null;
  start_date: string | null;
  distance_km: number | null;
  elevation_gain_m: number | null;
  logo_url: string | null;
  hero_image_url: string | null;
  race_type: string | null;
  surface_type: string | null;
  category_tags: string[] | null;
};

function locationLabel(r: CanonicalRaceDbRow | null): string {
  if (!r) return "";
  const parts = [r.city, r.region, r.country].filter((x) => Boolean(x?.trim()));
  return parts.join(", ");
}

function toView(row: UserBucketListGoalRow, cr: CanonicalRaceDbRow | null): CanonicalBucketGoalView {
  return {
    id: row.id,
    user_id: row.user_id,
    canonical_race_id: row.canonical_race_id,
    status: row.status,
    added_at: row.added_at,
    completed_at: row.completed_at,
    linked_strava_activity_id: row.linked_strava_activity_id,
    linked_user_race_id: row.linked_user_race_id,
    profile_approved_at: row.profile_approved_at,
    notes: row.notes,
    raceName: cr?.name ?? "Race",
    slug: cr?.slug ?? "",
    locationLabel: locationLabel(cr),
    startDate: cr?.start_date ?? null,
    distanceKm: cr?.distance_km ?? null,
    elevationGainM: cr?.elevation_gain_m ?? null,
    logoUrl: cr?.logo_url ?? null,
    heroImageUrl: cr?.hero_image_url ?? null,
    raceType: cr?.race_type ?? null,
    surfaceType: cr?.surface_type ?? null,
    categoryTags: cr?.category_tags ?? []
  };
}

const FUTURE_STATUSES: BucketListGoalStatus[] = ["saved", "planned"];
const DONE_STATUSES: BucketListGoalStatus[] = [
  "completed_unlinked",
  "completed_linked",
  "featured_on_profile"
];

const GOAL_SELECT =
  "id, user_id, canonical_race_id, status, added_at, completed_at, linked_strava_activity_id, linked_user_race_id, profile_approved_at, notes";

const CANON_RACE_SELECT =
  "id, name, slug, city, region, country, start_date, distance_km, elevation_gain_m, logo_url, hero_image_url, race_type, surface_type, category_tags";

/**
 * Loads bucket list goals and joins canonical race metadata in a second query.
 * Avoids PostgREST nested-select quirks and RLS edge cases on embedded resources.
 */
export async function fetchCanonicalBucketGoalsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<{ future: CanonicalBucketGoalView[]; completed: CanonicalBucketGoalView[] }> {
  const { data: goals, error } = await supabase
    .from("user_bucket_list_goals")
    .select(GOAL_SELECT)
    .eq("user_id", userId)
    .order("added_at", { ascending: false });

  if (error) {
    runfolioLog.error("bucketListCanonical.fetchGoals", error, { userId, code: error.code });
    return { future: [], completed: [] };
  }

  const goalRows = (goals ?? []) as UserBucketListGoalRow[];
  const ids = [...new Set(goalRows.map((g) => g.canonical_race_id).filter(Boolean))];

  const raceById = new Map<string, CanonicalRaceDbRow>();
  if (ids.length > 0) {
    const { data: races, error: rErr } = await supabase.from("canonical_races").select(CANON_RACE_SELECT).in("id", ids);
    if (rErr) {
      runfolioLog.warn("bucketListCanonical.fetchRaceDetails", rErr.message, {
        userId,
        idCount: ids.length,
        code: rErr.code,
        hint: rErr.hint
      });
    } else {
      for (const r of (races ?? []) as CanonicalRaceDbRow[]) {
        raceById.set(r.id, r);
      }
    }
  }

  const views = goalRows.map((row) => toView(row, raceById.get(row.canonical_race_id) ?? null));
  const future = views.filter((v) => FUTURE_STATUSES.includes(v.status));
  const completed = views.filter((v) => DONE_STATUSES.includes(v.status));

  runfolioLog.info("bucketListCanonical.fetch", "goals loaded", {
    userId,
    goalCount: goalRows.length,
    futureCount: future.length,
    completedCount: completed.length,
    raceDetailsResolved: raceById.size
  });

  return { future, completed };
}

export async function fetchCanonicalRaceIdsOnBucketList(
  supabase: SupabaseClient,
  userId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("user_bucket_list_goals")
    .select("canonical_race_id, status")
    .eq("user_id", userId)
    .in("status", FUTURE_STATUSES);

  if (error || !data) {
    runfolioLog.warn("bucketListCanonical.fetchIds", error?.message ?? "no data", { userId });
    return new Set();
  }
  return new Set(data.map((r) => r.canonical_race_id as string));
}
