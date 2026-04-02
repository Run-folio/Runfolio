import type { SupabaseClient } from "@supabase/supabase-js";
import type { StravaRaceCandidate } from "@/types";

/**
 * Previously auto-completed bucket-list rows from high-confidence Strava matches on profile load.
 * That violated intentional confirmation: bucket completion now only happens via
 * `confirmKnownRaceMatchAction` with an explicit bucket row + user action.
 */
export async function applyHighConfidenceStravaBucketSync(
  _supabase: SupabaseClient,
  _userId: string,
  _enriched: StravaRaceCandidate[]
): Promise<void> {
  void _supabase;
  void _userId;
  void _enriched;
}
