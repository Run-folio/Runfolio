import { isDynamicServerError } from "next/dist/client/components/hooks-server-context";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { AppNavbar } from "@/components/app-navbar";
import { CreateRaceForm } from "@/components/create-race-form";
import { getServerAuthUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import type { Race } from "@/types";
import { demoRaces, isSupabaseConfigured } from "@/lib/demo-mode";
import { runfolioLog } from "@/lib/runfolio-log";
import { hasStravaConnection } from "@/lib/strava-access-server";
import { getStravaFeed } from "@/lib/strava-feed";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ strava?: string; strava_error?: string }>;
};

export default async function NewRacePage({ searchParams }: PageProps) {
  const q = await searchParams;
  const stravaOAuthConfigured = Boolean(
    process.env.STRAVA_CLIENT_ID?.trim() && process.env.STRAVA_CLIENT_SECRET?.trim()
  );
  const stravaFeed = await getStravaFeed();
  const stravaConnected =
    (await hasStravaConnection()) || q.strava === "connected";

  let existingRaces: Race[] = demoRaces;
  if (isSupabaseConfigured()) {
    try {
      const { user, authError } = await getServerAuthUser();
      if (authError) throw new Error(authError);
      if (!user) redirect("/auth/login");
      const supabase = await createClient();
      const result = await supabase.from("races").select("*").eq("user_id", user.id);
      if (result.error) {
        runfolioLog.warn("RacesNew.races", result.error.message ?? "query error");
        existingRaces = [];
      } else {
        existingRaces = (result.data ?? []) as Race[];
      }
    } catch (e) {
      if (isDynamicServerError(e)) throw e;
      if (isRedirectError(e)) throw e;
      runfolioLog.error("RacesNew.supabase", e);
      redirect("/auth/login?error=supabase_unavailable");
    }
  }

  return (
    <>
      <AppNavbar />
      <section className="hero-full min-h-[240px]">
        <div className="hero-bg" style={{ backgroundImage: "url('/reference/hero-1.png')" }} />
        <div className="hero-overlay" />
        <div className="hero-inner flex min-h-[240px] flex-col justify-end pb-10">
          <h1 className="type-display max-w-4xl">Create / Edit Race</h1>
          <p className="type-tagline mt-4 max-w-2xl">
            Every race tells a story. We&apos;ll handle the details—you focus on what matters.
          </p>
        </div>
      </section>

      <main className="app-shell space-y-6 pb-16">
        <CreateRaceForm
          existingRaces={existingRaces}
          stravaOAuthConfigured={stravaOAuthConfigured}
          stravaConnected={stravaConnected}
          stravaError={q.strava_error ? decodeURIComponent(q.strava_error) : undefined}
          recentStravaActivities={stravaFeed.activities}
        />
      </main>
    </>
  );
}
