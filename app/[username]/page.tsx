import { isDynamicServerError } from "next/dist/client/components/hooks-server-context";
import { AppNavbar } from "@/components/app-navbar";
import { ProfileBucketList } from "@/components/profile-bucket-list";
import { ProfileHero } from "@/components/profile-hero";
import { ProfileTopRaces } from "@/components/profile-top-races";
import { RaceJourney } from "@/components/race-journey";
import { StravaProfileBlock } from "@/components/strava-profile-block";
import { getServerAuthUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import { demoRaces, demoUser, isSupabaseConfigured } from "@/lib/demo-mode";
import { resolveProfileHeroPhoto } from "@/lib/profile-hero-asset";
import { runfolioLog } from "@/lib/runfolio-log";
import { getStravaFeed } from "@/lib/strava-feed";
import type { StravaFeedActivity, StravaFeedStats } from "@/types";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ username: string }>;
};

export default async function PublicProfilePage({ params }: Props) {
  const profileHeroPhoto = resolveProfileHeroPhoto();
  const { username } = await params;
  let runner: { id: string; name: string } | null = { id: demoUser.id, name: username || demoUser.name };
  let allRaces = [...demoRaces];
  const stravaOAuthConfigured = Boolean(
    process.env.STRAVA_CLIENT_ID?.trim() && process.env.STRAVA_CLIENT_SECRET?.trim()
  );
  let ownProfileStrava: { activities: StravaFeedActivity[]; stats: StravaFeedStats } | null = null;

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const userResult = await supabase.from("users").select("*").eq("name", username).single();
      if (userResult.error && userResult.error.code !== "PGRST116") {
        throw new Error(userResult.error.message);
      }
      runner = userResult.data;
      if (runner) {
        const racesResult = await supabase
          .from("races")
          .select("*")
          .eq("user_id", runner.id)
          .order("date", { ascending: false });
        if (racesResult.error) throw new Error(racesResult.error.message);
        allRaces = racesResult.data ?? [];
      } else {
        allRaces = [];
      }

      const { user } = await getServerAuthUser();
      if (user?.id && runner && user.id === runner.id) {
        const feed = await getStravaFeed();
        ownProfileStrava = { activities: feed.activities, stats: feed.stats };
      }
    } catch (e) {
      if (isDynamicServerError(e)) throw e;
      runfolioLog.error("PublicProfile.supabase", e, { username });
      runner = { id: demoUser.id, name: username || demoUser.name };
      allRaces = [...demoRaces];
    }
  }

  const completed = (allRaces ?? []).filter((r) => r.is_completed);
  const future = (allRaces ?? []).filter((r) => !r.is_completed);
  const displayName = runner?.name ?? decodeURIComponent(username);

  return (
    <>
      <AppNavbar />
      <main className="min-h-screen bg-[#05070c]">
        <ProfileHero key={profileHeroPhoto} displayName={displayName} imageSrc={profileHeroPhoto} />

        <div className="mx-auto w-full max-w-[1400px] px-0">
          <ProfileTopRaces races={completed} />

          {ownProfileStrava ? (
            <StravaProfileBlock
              activities={ownProfileStrava.activities}
              stats={ownProfileStrava.stats}
              stravaOAuthConfigured={stravaOAuthConfigured}
            />
          ) : null}

          <div className="grid gap-0 border-x border-border lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <RaceJourney races={allRaces} />
            <ProfileBucketList completed={completed} future={future} />
          </div>
        </div>
      </main>
    </>
  );
}
