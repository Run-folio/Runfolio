import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DevCanonicalMatchRowDebug, MatchHubBundle } from "@/lib/match-hub/service";
import { loadMatchHubBundle } from "@/lib/match-hub/service";
import { resolveDefaultProfilePathForUser } from "@/lib/profile-path-server";
import { confirmedCompletedPortfolioRaces } from "@/lib/portfolio-race";
import { loadUserStravaOverviewState } from "@/lib/strava-user-overview";
import type { Race } from "@/types";

export type DevMatchDebugSnapshot = {
  page: "dashboard" | "matches" | "profile";
  importedActivitiesCount: number;
  suggestedMatchesCount: number;
  confirmedMatchesCount: number;
  recentHubConfirmationsCount: number;
  profileSlugInUrl: string;
  resolvedProfilePath: string;
  usersRow: { exists: boolean; name: string | null };
  authMetadataName: string | null;
  authEmailPrefix: string | null;
  slugAlignedWithUsersTable: boolean;
  /** First hub-queue activities with canonical candidate trace (matches page when bundle includes traces). */
  canonicalMatchDebugSamples: Array<
    DevCanonicalMatchRowDebug & { stravaActivityId: string; activityTitle: string }
  >;
};

type Cache = {
  portfolioRaces?: Race[];
  stravaOverview?: Awaited<ReturnType<typeof loadUserStravaOverviewState>>;
  bundle?: MatchHubBundle;
};

/**
 * Single source for dev HUD counts: same `loadUserStravaOverviewState` + `loadMatchHubBundle` as production Match hub.
 */
export async function loadDevMatchDebugSnapshot(
  supabase: SupabaseClient,
  userId: string,
  authUser: User | null,
  context: { page: DevMatchDebugSnapshot["page"]; profileSlugFromUrl?: string },
  cache?: Cache
): Promise<DevMatchDebugSnapshot> {
  const portfolioRaces =
    cache?.portfolioRaces ??
    (((await supabase.from("races").select("*").eq("user_id", userId)).data ?? []) as Race[]);

  const stravaOverview = cache?.stravaOverview ?? (await loadUserStravaOverviewState(supabase, userId));

  const bundle =
    cache?.bundle ??
    (await loadMatchHubBundle(supabase, userId, portfolioRaces, { syncedRows: stravaOverview.syncedRows }));

  const { data: urow } = await supabase.from("users").select("name").eq("id", userId).maybeSingle();
  const usersName = (urow as { name?: string } | null)?.name ?? null;

  const rawSlug = context.profileSlugFromUrl?.trim() ?? "";
  const decodedSlug = rawSlug ? decodeURIComponent(rawSlug) : "";

  const resolvedPath = await resolveDefaultProfilePathForUser(supabase, userId);

  const metaName =
    authUser && typeof authUser.user_metadata?.name === "string" ? authUser.user_metadata.name.trim() : null;
  const emailPre = authUser?.email?.split("@")[0]?.trim() ?? null;

  const completed = confirmedCompletedPortfolioRaces(portfolioRaces);

  const devMap = bundle.devCanonicalMatchByActivityId;
  let canonicalMatchDebugSamples: DevMatchDebugSnapshot["canonicalMatchDebugSamples"] = [];
  if (devMap && Object.keys(devMap).length > 0) {
    const titleByStravaId = new Map(stravaOverview.syncedRows.map((r) => [r.strava_activity_id, r.name]));
    const ids = Object.keys(devMap).slice(0, 5);
    canonicalMatchDebugSamples = ids.map((id) => ({
      stravaActivityId: id,
      activityTitle: titleByStravaId.get(id) ?? "—",
      ...devMap[id]!
    }));
  }

  return {
    page: context.page,
    importedActivitiesCount: stravaOverview.syncedRows.length,
    suggestedMatchesCount: bundle.suggestedHigh.length,
    confirmedMatchesCount: completed.length,
    recentHubConfirmationsCount: bundle.recentlyConfirmed.length,
    profileSlugInUrl: decodedSlug || "—",
    resolvedProfilePath: resolvedPath,
    usersRow: { exists: Boolean(urow), name: usersName },
    authMetadataName: metaName,
    authEmailPrefix: emailPre,
    slugAlignedWithUsersTable: Boolean(
      decodedSlug && usersName && decodedSlug.toLowerCase() === usersName.trim().toLowerCase()
    ),
    canonicalMatchDebugSamples
  };
}
