import type { SupabaseClient } from "@supabase/supabase-js";
import type { Race } from "@/types";

export type CanonicalRaceBucketGoalRow = {
  id: string;
  status: string;
  linked_strava_activity_id: string | null;
  linked_user_race_id: string | null;
};

/** Logged-in context for canonical race detail (bucket goal + portfolio rows). */
export async function fetchCanonicalRaceViewerState(
  supabase: SupabaseClient,
  userId: string,
  canonicalRaceId: string
): Promise<{
  bucketGoal: CanonicalRaceBucketGoalRow | null;
  portfolioRaces: Race[];
  /** Best row to link “your story” (completed portfolio or bucket-linked finish). */
  primaryFinish: Race | null;
}> {
  const [{ data: goal, error: gErr }, { data: portfolio, error: pErr }] = await Promise.all([
    supabase
      .from("user_bucket_list_goals")
      .select("id, status, linked_strava_activity_id, linked_user_race_id")
      .eq("user_id", userId)
      .eq("canonical_race_id", canonicalRaceId)
      .maybeSingle(),
    supabase.from("races").select("*").eq("user_id", userId).eq("canonical_race_id", canonicalRaceId)
  ]);

  const bucketGoal = gErr ? null : (goal as CanonicalRaceBucketGoalRow | null);
  let portfolioRaces = pErr ? [] : ((portfolio ?? []) as Race[]);
  const completed = portfolioRaces
    .filter((r) => r.is_completed)
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
  let primaryFinish = completed[0] ?? null;

  if (!primaryFinish && bucketGoal?.linked_user_race_id) {
    const { data: linkRow } = await supabase
      .from("races")
      .select("*")
      .eq("user_id", userId)
      .eq("id", bucketGoal.linked_user_race_id)
      .maybeSingle();
    if (linkRow) {
      primaryFinish = linkRow as Race;
      if (!portfolioRaces.some((r) => r.id === primaryFinish!.id)) {
        portfolioRaces = [...portfolioRaces, primaryFinish];
      }
    }
  }

  return { bucketGoal, portfolioRaces, primaryFinish };
}
