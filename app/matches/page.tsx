import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AppNavbar } from "@/components/app-navbar";
import { DataBackendSetupGate } from "@/components/data-backend-setup-gate";
import { MatchHubClient } from "@/components/match-hub/match-hub-client";
import { SyncStravaActivitiesButton } from "@/components/sync-strava-activities-button";
import { getServerAuthUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/demo-mode";
import { loadMatchHubBundle } from "@/lib/match-hub/service";
import { resolveDefaultProfilePathForUser } from "@/lib/profile-path-server";
import { withRaceLinkedCelebration } from "@/lib/profile-race-linked-celebration";
import type { Race } from "@/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Match & Import · Runfolio",
  description: "Review Strava activities, confirm race finishes, and keep your story accurate."
};

export default async function MatchHubPage() {
  if (!isSupabaseConfigured()) {
    return <DataBackendSetupGate title="Match &amp; Import" featureLabel="Match &amp; Import" />;
  }

  const { user, authError } = await getServerAuthUser();
  if (authError || !user) {
    redirect(`/auth/login?next=${encodeURIComponent("/matches")}`);
  }

  const supabase = await createClient();
  const { data: racesRes } = await supabase.from("races").select("*").eq("user_id", user.id);
  const portfolioRaces = (racesRes ?? []) as Race[];

  const bundle = await loadMatchHubBundle(supabase, user.id, portfolioRaces);
  const profilePath = await resolveDefaultProfilePathForUser(supabase, user.id);
  const profileHref = profilePath !== "/dashboard" ? profilePath : "/dashboard";
  const completedRacesHref =
    profilePath !== "/dashboard" ? `${profilePath}#profile-completed-races` : "/dashboard";
  const profileFinishHref =
    profilePath !== "/dashboard" ? withRaceLinkedCelebration(`${profilePath}#profile-completed-races`) : "/dashboard";

  const stravaOAuthConfigured = Boolean(
    process.env.STRAVA_CLIENT_ID?.trim() && process.env.STRAVA_CLIENT_SECRET?.trim()
  );

  const totalAttention =
    bundle.suggestedHigh.length +
    bundle.needsReview.length +
    bundle.unmatched.length +
    bundle.snoozed.length;

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
              We surface long efforts that look like races. Confirm a verified event and the finish lands in your
              completed races — ready for your profile when you want the spotlight.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              {stravaOAuthConfigured ? <SyncStravaActivitiesButton /> : null}
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
                {totalAttention} item{totalAttention === 1 ? "" : "s"} in the queue (review + snoozed)
              </p>
            ) : bundle.totalSyncedCount === 0 ? (
              <p className="mt-6 max-w-2xl text-sm text-white/55">
                {stravaOAuthConfigured
                  ? "No Strava activities stored in Runfolio yet. Sync above after a race effort — long runs and “race” types are what we look at."
                  : "Strava OAuth isn’t set on this server, so nothing has been imported automatically. Use Browse verified races or Add a race manually, or configure STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET for sync."}
              </p>
            ) : (
              <p className="mt-6 max-w-2xl text-sm text-white/55">
                Nothing in the active queue right now — your synced activities are either already matched, marked as
                training, snoozed, or not flagged as race-like.
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
          />
        </div>
      </main>
    </>
  );
}
