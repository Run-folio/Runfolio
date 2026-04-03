import type { SupabaseClient } from "@supabase/supabase-js";
import { runfolioLog } from "@/lib/runfolio-log";

export type PublicRaceFinisher = {
  user_id: string;
  runner_name: string;
  race_id: string;
  finish_date: string | null;
};

function parseFinishersPayload(raw: unknown): PublicRaceFinisher[] {
  if (!Array.isArray(raw)) return [];
  const out: PublicRaceFinisher[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const userId = o.user_id;
    const name = o.runner_name;
    const raceId = o.race_id;
    if (typeof userId !== "string" || typeof name !== "string" || typeof raceId !== "string") continue;
    out.push({
      user_id: userId,
      runner_name: name,
      race_id: raceId,
      finish_date: typeof o.finish_date === "string" ? o.finish_date : null
    });
  }
  return out;
}

export async function fetchPublicFinishersForDiscoverRace(
  supabase: SupabaseClient,
  discoverRaceId: string,
  limit = 48
): Promise<PublicRaceFinisher[]> {
  try {
    const { data, error } = await supabase.rpc("list_public_finishers_for_discover_race", {
      p_discover_race_id: discoverRaceId.trim(),
      p_limit: limit
    });
    if (error) {
      runfolioLog.warn("fetchPublicFinishersForDiscoverRace", error.message ?? "rpc error");
      return [];
    }
    return parseFinishersPayload(data);
  } catch (e) {
    runfolioLog.error("fetchPublicFinishersForDiscoverRace", e, { discoverRaceId });
    return [];
  }
}

export async function fetchPublicFinishersForCanonicalRace(
  supabase: SupabaseClient,
  canonicalRaceId: string,
  limit = 48
): Promise<PublicRaceFinisher[]> {
  try {
    const { data, error } = await supabase.rpc("list_public_finishers_for_canonical_race", {
      p_canonical_race_id: canonicalRaceId,
      p_limit: limit
    });
    if (error) {
      runfolioLog.warn("fetchPublicFinishersForCanonicalRace", error.message ?? "rpc error");
      return [];
    }
    return parseFinishersPayload(data);
  } catch (e) {
    runfolioLog.error("fetchPublicFinishersForCanonicalRace", e, { canonicalRaceId });
    return [];
  }
}
