import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AppNavbar } from "@/components/app-navbar";
import { DataBackendSetupGate } from "@/components/data-backend-setup-gate";
import { StravaBackfillExperience } from "@/components/strava-backfill-experience";
import { ensurePublicUserRowForAuthedRequest } from "@/lib/auth-ensure-public-user-on-request";
import { getServerAuthUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/demo-mode";
import { loadStravaBackfillProgress } from "@/lib/strava-backfill-progress";
import { requirePersistenceReadyOrRedirect } from "@/lib/require-persistence-ready";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Import past race efforts · Runfolio",
  description:
    "Import likely race efforts from Strava in bounded, resumable batches. Saved locally for Match & Import; ongoing sync only fetches new activities."
};

export default async function ImportPastRacesPage() {
  if (!isSupabaseConfigured()) {
    return (
      <DataBackendSetupGate
        title="Import past race efforts"
        featureLabel="Strava history import"
        returnTo="/import/past-races"
      />
    );
  }

  await requirePersistenceReadyOrRedirect("/import/past-races");

  const { user, authError } = await getServerAuthUser();
  if (authError || !user) {
    redirect(`/auth/login?next=${encodeURIComponent("/import/past-races")}`);
  }

  const supabase = await createClient();
  await ensurePublicUserRowForAuthedRequest(supabase, user);

  const progress = await loadStravaBackfillProgress(supabase, user.id);
  const stravaOAuthConfigured = Boolean(
    process.env.STRAVA_CLIENT_ID?.trim() && process.env.STRAVA_CLIENT_SECRET?.trim()
  );

  return (
    <>
      <AppNavbar />
      <main className="min-h-screen bg-[#05070c] pb-24">
        <div className="app-shell mx-auto max-w-[720px] px-5 py-10 md:px-8 md:py-14">
          <StravaBackfillExperience initialProgress={progress} stravaOAuthConfigured={stravaOAuthConfigured} />
        </div>
        <p className="pb-8 text-center text-[11px] leading-relaxed text-muted">
          For <strong className="font-medium text-white/70">new activities only</strong> after import, use{" "}
          <Link href="/dashboard" className="font-semibold text-accent underline-offset-4 hover:underline">
            Overview
          </Link>{" "}
          or{" "}
          <Link href="/matches" className="font-semibold text-accent underline-offset-4 hover:underline">
            Match &amp; import
          </Link>{" "}
          → <span className="text-white/55">Sync new activities from Strava</span>.{" "}
          <Link href="/races/find" className="font-semibold text-accent underline-offset-4 hover:underline">
            Find a race
          </Link>{" "}
          to link a specific finish from saved activities (broader than backfill) or use Add race with a Strava URL.{" "}
          <Link href="/import/activity-file" className="font-semibold text-emerald-300/90 underline-offset-4 hover:underline">
            Import an activity file
          </Link>{" "}
          (FIT/GPX/TCX) if Strava is unavailable.
        </p>
      </main>
    </>
  );
}
