import type { Metadata } from "next";
import { AppNavbar } from "@/components/app-navbar";
import { DataBackendSetupGate } from "@/components/data-backend-setup-gate";
import { SetupFlowContent } from "@/components/setup/setup-flow-content";
import { isSupabaseConfigured } from "@/lib/demo-mode";
import { buildOnboardingProgress } from "@/lib/onboarding-progress";
import { getServerPersistenceReadiness } from "@/lib/persistence-readiness";
import { parseSafeRedirectPath } from "@/lib/safe-redirect-path";
import { hasStravaConnection } from "@/lib/strava-access-server";
import { createClient } from "@/lib/supabase/server";
import { listSyncedActivitiesForUser } from "@/lib/strava-sync/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Get set up · Runfolio",
  description: "Sign in, connect Strava, and import activities so your bucket list and matches stay real."
};

type Props = { searchParams: Promise<{ next?: string }> };

export default async function SetupPage({ searchParams }: Props) {
  const sp = await searchParams;
  const safeNext = parseSafeRedirectPath(sp.next ?? "") ?? "/dashboard";

  if (!isSupabaseConfigured()) {
    return (
      <DataBackendSetupGate
        title="Get set up"
        featureLabel="Saving goals, matches, and Strava sync"
        returnTo={safeNext}
      />
    );
  }

  const persistence = await getServerPersistenceReadiness();
  const stravaOAuthConfigured = Boolean(
    process.env.STRAVA_CLIENT_ID?.trim() && process.env.STRAVA_CLIENT_SECRET?.trim()
  );
  const stravaConnected = await hasStravaConnection();

  let syncedActivityCount = 0;
  if (persistence.status === "ready" && persistence.userId) {
    const supabase = await createClient();
    const rows = await listSyncedActivitiesForUser(supabase, persistence.userId);
    syncedActivityCount = rows.length;
  }

  const progress = buildOnboardingProgress({
    persistence,
    stravaOAuthConfigured,
    stravaConnected,
    syncedActivityCount,
    safeNext
  });

  return (
    <>
      <AppNavbar />
      <main className="min-h-screen bg-[#05070c] pb-24">
        <header className="border-b border-white/[0.06] bg-[#070a10] px-5 py-10 md:px-10 md:py-14">
          <div className="app-shell mx-auto max-w-[720px] text-center">
            <p className="type-eyebrow text-accent">Welcome in</p>
            <h1 className="font-display mt-3 text-4xl font-normal tracking-tight text-white md:text-[2.75rem]">
              Get set up
            </h1>
            <p className="type-meta mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/68">
              Straight path from account to Strava to your first confirmed finish — no admin jargon, just what unlocks
              your story.
            </p>
          </div>
        </header>

        <div className="app-shell mx-auto max-w-[720px] px-5 pt-10 md:px-8">
          <SetupFlowContent persistence={persistence} progress={progress} safeNext={safeNext} />
        </div>
      </main>
    </>
  );
}
