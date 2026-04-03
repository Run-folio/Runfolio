import { createClient } from "@/lib/supabase/server";
import { runfolioLog } from "@/lib/runfolio-log";
import type { Race } from "@/types";

type BundleRunner = { id: string; name: string };

type BundleJson = {
  runner: BundleRunner | null;
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
    const obj = data as { runner?: BundleRunner | null; races?: unknown };
    const races = Array.isArray(obj.races) ? (obj.races as Race[]) : [];
    const runner = obj.runner && typeof obj.runner.id === "string" ? obj.runner : null;
    return { runner, races };
  } catch (e) {
    runfolioLog.error("fetchPublicProfileBundle", e, { username: raw });
    return { runner: null, races: [] };
  }
}
