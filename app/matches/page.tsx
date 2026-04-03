import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AppNavbar } from "@/components/app-navbar";
import { DataBackendSetupGate } from "@/components/data-backend-setup-gate";
import { DevMatchDebugSummary } from "@/components/dev-match-debug-summary";
import { MatchHubClient } from "@/components/match-hub/match-hub-client";
import { StravaIncrementalSyncButton } from "@/components/strava-incremental-sync-button";
import { ensurePublicUserRowForAuthedRequest } from "@/lib/auth-ensure-public-user-on-request";
import { getServerAuthUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/demo-mode";
import { loadDevMatchDebugSnapshot } from "@/lib/dev-match-debug-snapshot";
import { loadMatchHubBundle } from "@/lib/match-hub/service";
import { loadUserStravaOverviewState } from "@/lib/strava-user-overview";
import { resolveDefaultProfilePathForUser } from "@/lib/profile-path-server";
import { buildSetupUrl } from "@/lib/setup-url";
import { requirePersistenceReadyOrRedirect } from "@/lib/require-persistence-ready";
import { withRaceLinkedCelebration } from "@/lib/profile-race-linked-celebration";
import type { Race } from "@/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Match & Import · Runfolio",
  description:
    "Strong suggested matches at 80%+ catalog confidence, plus manual linking when we do not auto-suggest."
};

export default async function MatchHubPage() {
  if (!isSupabaseConfigured()) {
    return (
      <DataBackendSetupGate title="Match &amp; Import" featureLabel="Match &amp; Import" returnTo="/matches" />
    );
  }

  await requirePersistenceReadyOrRedirect("/matches");

  const { user, authError } = await getServerAuthUser();
  if (authError || !user) {
    redirect(`/auth/login?next=${encodeURIComponent("/matches")}`);
  }

  const supabase = await createClient();
  await ensurePublicUserRowForAuthedRequest(supabase, user);
  const { data: racesRes } = await supabase.from("races").select("*").eq("user_id", user.id);
  const portfolioRaces = (racesRes ?? []) as Race[];

  const stravaOverview = await loadUserStravaOverviewState(supabase, user.id);
  const bundle = await loadMatchHubBundle(supabase, user.id, portfolioRaces, {
    syncedRows: stravaOverview.syncedRows,
    collectDevCanonicalTraces: process.env.NODE_ENV === "development"
  });
  const liveStravaActivityCount = stravaOverview.syncedRows.length;
  const profilePath = await resolveDefaultProfilePathForUser(supabase, user.id);
  const profileHref = profilePath !== "/dashboard" ? profilePath : "/dashboard";
  const completedRacesHref =
    profilePath !== "/dashboard" ? `${profilePath}#profile-completed-races` : "/dashboard";
  const profileFinishHref =
    profilePath !== "/dashboard" ? withRaceLinkedCelebration(`${profilePath}#profile-completed-races`) : "/dashboard";

  const stravaOAuthConfigured = Boolean(
    process.env.STRAVA_CLIENT_ID?.trim() && process.env.STRAVA_CLIENT_SECRET?.trim()
  );

  const totalAttention = bundle.suggestedHigh.length + bundle.unmatched.length + bundle.snoozed.length;

  const devMatchDebug =
    process.env.NODE_ENV === "development"
      ? await loadDevMatchDebugSnapshot(
          supabase,
          user.id,
          user,
          {
            page: "matches",
            profileSlugFromUrl: profilePath !== "/dashboard" ? profilePath.replace(/^\//, "") : undefined
          },
          { portfolioRaces, stravaOverview, bundle }
        )
      : null;

  return (
    <>
      <AppNavbar />
      <main className="min-h-screen bg-[#05070c] pb-24">
        <header className="border-b border-white/10 bg-[#070a10] px-5 py-10 md:px-8 md:py-14">
          <div className="app-shell mx-auto max-w-[1100px]">
            <p className="type-eyebrow text-accent">Strava → your story</p>
            <h1 className="font-display mt-3 text-4xl font-normal tracking-tight text-white md:text-5xl">
              Match &amp; Import
            </h1>
            <p className="type-meta mt-4 max-w-2xl text-base leading-relaxed text-white/70">
              <strong className="font-medium text-white/85">Suggested matches</strong> are one-tap only when we&apos;re{" "}
              <strong className="font-medium text-white/85">at least 80%</strong> confident versus the verified catalog.
              Everything else stays out of that row — use manual linking or optional softer hints below. Matching runs on
              activities saved in Runfolio.{" "}
              <Link href="/import/past-races" className="font-semibold text-accent underline-offset-4 hover:underline">
                Import past race efforts
              </Link>{" "}
              walks your Strava history in batches; use <strong className="font-medium text-white/85">Sync new only</strong>{" "}
              below for new activities since your last sync.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              {stravaOAuthConfigured ? (
                <>
                  <Link
                    href="/import/past-races"
                    className="inline-flex min-h-[36px] items-center rounded-[12px] bg-accent px-4 text-[10px] font-semibold uppercase tracking-wider text-white transition hover:bg-[#f08a4d] md:text-[11px]"
                  >
                    Import past race efforts
                  </Link>
                  <StravaIncrementalSyncButton compact className="max-w-[220px]" />
                </>
              ) : null}
              <Link
                href="/races/find"
                className="text-[12px] font-semibold uppercase tracking-[0.15em] text-muted hover:text-white"
              >
                Browse verified races →
              </Link>
              <Link
                href="/races/new"
                className="text-[12px] font-semibold uppercase tracking-[0.15em] text-muted hover:text-white"
              >
                Add a race manually →
              </Link>
            </div>
            {totalAttention > 0 ? (
              <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-400/35 bg-amber-500/10 px-4 py-2 text-[12px] font-medium text-amber-100/90">
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-300" aria-hidden />
                {totalAttention} open item{totalAttention === 1 ? "" : "s"}
                {bundle.suggestedHigh.length > 0
                  ? ` · ${bundle.suggestedHigh.length} suggested (80%+)`
                  : bundle.totalSyncedCount > 0
                    ? " · no 80%+ suggestions yet"
                    : ""}
              </p>
            ) : bundle.totalSyncedCount === 0 ? (
              <p className="mt-6 max-w-2xl text-sm text-white/55">
                {stravaOAuthConfigured
                  ? liveStravaActivityCount != null && liveStravaActivityCount > 0
                    ? "Strava returned activities in this session, but none are saved in Runfolio yet. Use Import past race efforts above — saved summaries power this hub."
                    : "No Strava activities stored in Runfolio yet. Import past race efforts above — we match from what’s saved here, not from a live preview alone."
                  : "Strava OAuth isn’t set on this server, so nothing has been imported automatically. Use Browse verified races or Add a race manually, or configure STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET for sync."}{" "}
                <Link
                  href={buildSetupUrl("/matches")}
                  className="font-semibold text-accent underline-offset-4 hover:underline"
                >
                  Open setup guide
                </Link>
              </p>
            ) : (
              <p className="mt-6 max-w-2xl text-sm text-white/55">
                All clear — saved Strava rows are matched, excluded, snoozed, or not in the race-like bucket. Nothing is
                queued for strong suggestions or manual linking.
              </p>
            )}
          </div>
        </header>

        <div className="app-shell mx-auto max-w-[1100px] px-5 pt-10 md:px-8">
          <MatchHubClient
            initialBundle={bundle}
            profileHref={profileHref}
            completedRacesHref={completedRacesHref}
            profileFinishHref={profileFinishHref}
            stravaOAuthConfigured={stravaOAuthConfigured}
            liveStravaActivityCount={liveStravaActivityCount}
          />
        </div>
      </main>
      {devMatchDebug ? <DevMatchDebugSummary snapshot={devMatchDebug} /> : null}
    </>
  );
}
