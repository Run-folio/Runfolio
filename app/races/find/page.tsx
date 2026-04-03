import Link from "next/link";
import type { Metadata } from "next";
import { AppNavbar } from "@/components/app-navbar";
import { FindRacesExplorer } from "@/components/find-races-explorer";
import { fetchCanonicalRaceIdsOnBucketList } from "@/lib/bucket-list-canonical/queries";
import { getServerAuthUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/demo-mode";
import type { Race } from "@/types";

export const metadata: Metadata = {
  title: "Find a race · Runfolio"
};

export const dynamic = "force-dynamic";

export default async function FindRacePage() {
  let viewer: "guest" | "authed" = "guest";
  let userRaces: Race[] | null = null;
  let addedCanonicalRaceIds: string[] = [];
  if (isSupabaseConfigured()) {
    try {
      const { user } = await getServerAuthUser();
      if (user?.id) {
        viewer = "authed";
        const supabase = await createClient();
        const { data } = await supabase.from("races").select("*").eq("user_id", user.id);
        userRaces = (data as Race[]) ?? [];
        addedCanonicalRaceIds = [...(await fetchCanonicalRaceIdsOnBucketList(supabase, user.id))];
      }
    } catch {
      viewer = "guest";
      userRaces = null;
    }
  }

  return (
    <>
      <AppNavbar />
      <section className="hero-full min-h-[220px]">
        <div className="hero-bg" style={{ backgroundImage: "url('/reference/hero-1.png')" }} />
        <div className="hero-overlay" />
        <div className="hero-inner flex min-h-[220px] flex-col justify-end pb-8">
          <p className="type-eyebrow">Race library</p>
          <h1 className="type-display mt-3 max-w-4xl">Find a race</h1>
          <p className="type-tagline mt-4 max-w-2xl">
            Major marathons, UTMB World Series events, and epic ultras — search and filter, add goals straight to your
            bucket list, or open a race to link a Strava finish. Refine the story anytime from{" "}
            <Link href="/races/new" className="text-accent underline-offset-4 hover:underline">
              Add race
            </Link>
            .
          </p>
        </div>
      </section>

      <main className="app-shell pb-16">
        <FindRacesExplorer viewer={viewer} userRaces={userRaces} addedCanonicalRaceIds={addedCanonicalRaceIds} />
      </main>
    </>
  );
}
