import { isDynamicServerError } from "next/dist/client/components/hooks-server-context";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNavbar } from "@/components/app-navbar";
import { BucketListWorkflow } from "@/components/bucket-list-workflow";
import { getServerAuthUser } from "@/lib/auth-server";
import { usedStravaActivityIdsFromRaces } from "@/lib/catalog-discover-user-state";
import { raceCountsAsBucketListCompleted, raceIsBucketListFutureGoal } from "@/lib/bucket-list-model";
import { discoverRaces } from "@/lib/discover-races";
import { runfolioLog } from "@/lib/runfolio-log";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/demo-mode";
import { getStravaFeed } from "@/lib/strava-feed";
import type { Race } from "@/types";

export const dynamic = "force-dynamic";

export default async function BucketListPage() {
  let races: Race[] = [];
  if (isSupabaseConfigured()) {
    try {
      const { user, authError } = await getServerAuthUser();
      if (authError) throw new Error(authError);
      if (!user) redirect("/auth/login");
      const supabase = await createClient();
      const result = await supabase.from("races").select("*").eq("user_id", user.id).order("date", { ascending: false });
      if (result.error) {
        runfolioLog.warn("BucketList.races", result.error.message ?? "query error");
        races = [];
      } else {
        races = result.data ?? [];
      }
    } catch (e) {
      if (isDynamicServerError(e)) throw e;
      if (isRedirectError(e)) throw e;
      runfolioLog.error("BucketList.supabase", e);
      races = [];
    }
  }

  const completed = (races ?? []).filter(raceCountsAsBucketListCompleted);
  const future = (races ?? []).filter(raceIsBucketListFutureGoal);

  const stravaOAuthConfigured = Boolean(
    process.env.STRAVA_CLIENT_ID?.trim() && process.env.STRAVA_CLIENT_SECRET?.trim()
  );
  const feed = await getStravaFeed();
  const usedStravaIds = [...usedStravaActivityIdsFromRaces(races ?? [])];

  return (
    <>
      <AppNavbar />
      <section className="hero-full min-h-[280px]">
        <div className="hero-bg" style={{ backgroundImage: "url('/reference/hero-1.png')" }} />
        <div className="hero-overlay" />
        <div className="hero-inner flex min-h-[280px] flex-col justify-end pb-12">
          <p className="type-eyebrow">Bucket List</p>
          <h1 className="type-display mt-3 max-w-3xl">Goals you choose. Finishes you prove.</h1>
          <p className="type-meta mt-4 max-w-2xl">
            Search the library, save future goals, then link a real Strava activity to move each goal into your completed
            collection.
          </p>
        </div>
      </section>

      <main className="app-shell space-y-10 pb-16">
        <BucketListWorkflow
          futureGoals={future}
          completedBucketRaces={completed}
          catalogRaces={discoverRaces}
          raceCandidates={feed.raceCandidates}
          usedStravaIds={usedStravaIds}
          stravaOk={feed.ok}
          stravaOAuthConfigured={stravaOAuthConfigured}
        />

        <div className="flex flex-wrap gap-3 border-t border-white/10 pt-8">
          <Link
            href="/races/find"
            className="inline-flex items-center justify-center rounded-[12px] bg-accent px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-[#f08a4d]"
          >
            Browse race library
          </Link>
          <Link
            href="/races/new"
            className="inline-flex items-center justify-center rounded-[12px] border border-white/18 px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted transition hover:border-white/35 hover:text-white"
          >
            Add race manually
          </Link>
        </div>
      </main>
    </>
  );
}
