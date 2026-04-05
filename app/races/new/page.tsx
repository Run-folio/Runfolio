import { isDynamicServerError } from "next/dist/client/components/hooks-server-context";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { AppNavbar } from "@/components/app-navbar";
import { DataBackendSetupGate } from "@/components/data-backend-setup-gate";
import { CreateRaceForm } from "@/components/create-race-form";
import { getServerAuthUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import type { Race } from "@/types";
import { isSupabaseConfigured } from "@/lib/demo-mode";
import { requirePersistenceReadyOrRedirect } from "@/lib/require-persistence-ready";
import { runfolioLog } from "@/lib/runfolio-log";
import { buildSetupUrl } from "@/lib/setup-url";
import { hasStravaConnection } from "@/lib/strava-access-server";
import { isDiscoverCatalogRaceId } from "@/lib/discover-race-details";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ strava?: string; strava_error?: string; discover?: string }>;
};

export default async function NewRacePage({ searchParams }: PageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <DataBackendSetupGate title="Add race" featureLabel="Creating and saving races" returnTo="/races/new" />
    );
  }

  await requirePersistenceReadyOrRedirect("/races/new");

  const q = await searchParams;
  const initialDiscoverRaceId =
    q.discover && isDiscoverCatalogRaceId(q.discover) ? q.discover : undefined;
  const stravaOAuthConfigured = Boolean(
    process.env.STRAVA_CLIENT_ID?.trim() && process.env.STRAVA_CLIENT_SECRET?.trim()
  );
  const stravaConnected =
    (await hasStravaConnection()) || q.strava === "connected";

  let existingRaces: Race[] = [];
  if (isSupabaseConfigured()) {
    try {
      const { user, authError } = await getServerAuthUser();
      if (authError) throw new Error(authError);
      if (!user) redirect(buildSetupUrl("/races/new"));
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
      <main className="app-shell space-y-8 pb-16 pt-6 md:pt-8">
        <h1 className="type-display text-3xl md:text-4xl">Add Race</h1>
        <CreateRaceForm
          existingRaces={existingRaces}
          stravaOAuthConfigured={stravaOAuthConfigured}
          stravaConnected={stravaConnected}
          stravaError={q.strava_error ? decodeURIComponent(q.strava_error) : undefined}
          initialDiscoverRaceId={initialDiscoverRaceId}
        />
      </main>
    </>
  );
}
