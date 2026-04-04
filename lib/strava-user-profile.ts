import type { SupabaseClient } from "@supabase/supabase-js";
import { runfolioLog } from "@/lib/runfolio-log";

type StravaAthleteMe = {
  id?: number;
  firstname?: string;
  lastname?: string;
  profile_medium?: string | null;
  profile?: string | null;
};

export type StravaAthleteAuthPayload = {
  id: string;
  displayName: string;
  profileUrl: string | null;
};

/** Full athlete for OAuth login (id, name, avatar URL). */
export async function fetchStravaAthleteForAuth(accessToken: string): Promise<StravaAthleteAuthPayload | null> {
  const res = await fetch("https://www.strava.com/api/v3/athlete", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    runfolioLog.warn("strava.profile", "athlete_auth_fetch_failed", { status: res.status });
    return null;
  }
  const j = (await res.json()) as StravaAthleteMe;
  if (j.id == null || !Number.isFinite(Number(j.id))) return null;
  const id = String(j.id);
  const displayName = `${j.firstname ?? ""} ${j.lastname ?? ""}`.trim() || "Runner";
  const profileUrl = j.profile_medium?.trim() || j.profile?.trim() || null;
  return { id, displayName, profileUrl };
}

/**
 * GET /api/v3/athlete — includes profile_medium for the authenticated athlete.
 */
export async function fetchStravaAthleteProfileMedium(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.strava.com/api/v3/athlete", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    runfolioLog.warn("strava.profile", "athlete_fetch_failed", { status: res.status });
    return null;
  }
  const j = (await res.json()) as StravaAthleteMe;
  const url = j.profile_medium?.trim() || j.profile?.trim();
  return url || null;
}

/**
 * After OAuth connect: always refresh from Strava (user may have changed avatar).
 */
export async function refreshUserStravaProfileUrl(
  supabase: SupabaseClient,
  userId: string,
  accessToken: string
): Promise<void> {
  const url = await fetchStravaAthleteProfileMedium(accessToken);
  if (!url) return;
  const { error } = await supabase.from("users").update({ strava_profile_url: url }).eq("id", userId);
  if (error) {
    runfolioLog.warn("strava.profile", "users_update_failed", { code: error.code, message: error.message });
  }
}

/**
 * During sync/backfill: one athlete GET when the column is still empty (saves quota after first fill).
 */
export async function ensureUserStravaProfileUrl(
  supabase: SupabaseClient,
  userId: string,
  accessToken: string
): Promise<void> {
  const { data, error: readErr } = await supabase
    .from("users")
    .select("strava_profile_url")
    .eq("id", userId)
    .maybeSingle();
  if (readErr) {
    runfolioLog.warn("strava.profile", "users_read_failed", { code: readErr.code, message: readErr.message });
    return;
  }
  const row = data as { strava_profile_url?: string | null } | null;
  if (row?.strava_profile_url?.trim()) return;
  await refreshUserStravaProfileUrl(supabase, userId, accessToken);
}
