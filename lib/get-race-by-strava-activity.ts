import { createClient } from "@/lib/supabase/server";
import { demoRaces, isSupabaseConfigured } from "@/lib/demo-mode";
import { isDynamicServerError } from "next/dist/client/components/hooks-server-context";
import { runfolioLog } from "@/lib/runfolio-log";
import type { Race } from "@/types";

export async function getRaceByStravaActivityId(
  stravaActivityId: string,
  userId: string
): Promise<Race | null> {
  if (!isSupabaseConfigured()) {
    const found = demoRaces.find(
      (r) => r.strava_activity_id === stravaActivityId && r.user_id === userId
    );
    return found ? ({ ...found } as Race) : null;
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("races")
      .select("*")
      .eq("user_id", userId)
      .eq("strava_activity_id", stravaActivityId)
      .maybeSingle();
    if (error || !data) return null;
    return data as Race;
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    runfolioLog.error("getRaceByStravaActivityId", e, { stravaActivityId });
    return null;
  }
}
