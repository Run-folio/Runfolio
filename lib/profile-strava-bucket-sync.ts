import type { SupabaseClient } from "@supabase/supabase-js";
import type { StravaRaceCandidate } from "@/types";
import { getDiscoverRaceById } from "@/lib/known-race-match";
import { runfolioLog } from "@/lib/runfolio-log";

/**
 * For the profile owner: high-confidence Strava ↔ catalog matches that line up with an incomplete
 * bucket-list row are promoted to completed with Strava + discover ids. Idempotent per request.
 */
export async function applyHighConfidenceStravaBucketSync(
  supabase: SupabaseClient,
  userId: string,
  enriched: StravaRaceCandidate[]
): Promise<void> {
  for (const c of enriched) {
    const s = c.catalogSuggestion;
    if (!s || s.confidence !== "high" || !s.onUserBucketList || !s.userRaceId) continue;

    const discover = getDiscoverRaceById(s.discoverRaceId);
    if (!discover) continue;

    const { data: row, error: selErr } = await supabase
      .from("races")
      .select("id, user_id, is_completed")
      .eq("id", s.userRaceId)
      .single();

    if (selErr || !row || row.user_id !== userId || row.is_completed) continue;

    const location =
      [c.location_city, c.location_country].filter(Boolean).join(", ") || discover.location;

    const { error: upErr } = await supabase
      .from("races")
      .update({
        name: discover.name,
        location,
        date: c.start_date.slice(0, 10),
        distance_km: c.distance_km,
        elevation_m: c.elevation_m ?? null,
        time: c.moving_time_label,
        is_completed: true,
        strava_activity_id: c.strava_id,
        discover_race_id: s.discoverRaceId
      })
      .eq("id", s.userRaceId);

    if (upErr) {
      runfolioLog.warn("profileStravaBucketSync", upErr.message ?? "update failed", {
        raceId: s.userRaceId
      });
    }
  }
}
