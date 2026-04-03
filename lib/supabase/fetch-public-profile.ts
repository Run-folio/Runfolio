import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { runfolioLog } from "@/lib/runfolio-log";
import type { PublicRunnerProfile, Race } from "@/types";

type BundleJson = {
  runner: PublicRunnerProfile | null;
  races: Race[];
};

type RaceWithCanonicalJoin = Race & {
  canonical_races?: { logo_url?: string | null; hero_image_url?: string | null } | null;
};

function mapRaceWithCanonicalJoin(r: RaceWithCanonicalJoin): Race {
  const cr = r.canonical_races;
  const { canonical_races: _omit, ...rest } = r;
  return {
    ...rest,
    canonical_logo_url: cr?.logo_url ?? r.canonical_logo_url ?? null,
    canonical_hero_url: cr?.hero_image_url ?? r.canonical_hero_url ?? null
  };
}

/**
 * Loads the signed-in user’s runner row and races (RLS-safe for owner), mirroring `get_public_profile_bundle` shape.
 * Used when the RPC slug lookup fails but the URL matches metadata/email the app used for profile links.
 */
export async function fetchProfileBundleByUserId(userId: string): Promise<BundleJson> {
  try {
    const supabase = await createClient();
    const { data: urow, error: uerr } = await supabase
      .from("users")
      .select("id, name, profile_location, profile_tagline, profile_public")
      .eq("id", userId)
      .maybeSingle();
    if (uerr || !urow || typeof urow.name !== "string") {
      return { runner: null, races: [] };
    }
    const { data: raceRows } = await supabase
      .from("races")
      .select("*, canonical_races(logo_url, hero_image_url)")
      .eq("user_id", userId);
    const races = (raceRows ?? []).map((raw) => mapRaceWithCanonicalJoin(raw as RaceWithCanonicalJoin));
    const runner: PublicRunnerProfile = {
      id: urow.id,
      name: urow.name,
      profile_location: urow.profile_location ?? null,
      profile_tagline: urow.profile_tagline ?? null,
      profile_public: urow.profile_public !== false
    };
    return { runner, races };
  } catch (e) {
    runfolioLog.error("fetchProfileBundleByUserId", e, { userId });
    return { runner: null, races: [] };
  }
}

/** True when `/{username}` is the same slug AppNavbar would use for this user (metadata name, then email prefix). */
export function publicProfileUrlMatchesAuthUser(
  usernameFromRoute: string,
  runner: PublicRunnerProfile,
  user: User
): boolean {
  const u = decodeURIComponent(usernameFromRoute).trim().toLowerCase();
  if (!u) return false;
  if (runner.name.trim().toLowerCase() === u) return true;
  const meta = user.user_metadata?.name;
  if (typeof meta === "string" && meta.trim().toLowerCase() === u) return true;
  const pre = user.email?.split("@")[0]?.trim().toLowerCase();
  if (pre && pre === u) return true;
  return false;
}

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
