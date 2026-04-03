import { createClient } from "@/lib/supabase/server";
import { runfolioLog } from "@/lib/runfolio-log";
import type { PublicRunnerProfile, Race } from "@/types";

type BundleJson = {
  runner: PublicRunnerProfile | null;
  races: Race[];
};

/**
 * Loads a runner and their races for `/{username}` using `get_public_profile_bundle` RPC.
 * Works for signed-out visitors (avoids RLS blocking reads on other users’ rows).
 */
export async function fetchPublicProfileBundle(username: string): Promise<BundleJson> {
  const raw = decodeURIComponent(username).trim();
  if (!raw) {
    return { runner: null, races: [] };
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_public_profile_bundle", { p_username: raw });
    if (error) {
      runfolioLog.warn("fetchPublicProfileBundle.rpc", error.message ?? "rpc error", { username: raw });
      return { runner: null, races: [] };
    }
    if (!data || typeof data !== "object") {
      return { runner: null, races: [] };
    }
    const obj = data as { runner?: Partial<PublicRunnerProfile> | null; races?: unknown };
    const races = Array.isArray(obj.races) ? (obj.races as Race[]) : [];
    const runnerObj = obj.runner;
    const runner: PublicRunnerProfile | null =
      runnerObj && typeof runnerObj.id === "string" && typeof runnerObj.name === "string"
        ? {
            id: runnerObj.id,
            name: runnerObj.name,
            profile_location: runnerObj.profile_location ?? null,
            profile_tagline: runnerObj.profile_tagline ?? null,
            profile_public: runnerObj.profile_public !== false
          }
        : null;
    return { runner, races };
  } catch (e) {
    runfolioLog.error("fetchPublicProfileBundle", e, { username: raw });
    return { runner: null, races: [] };
  }
}
