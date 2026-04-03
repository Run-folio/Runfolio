import Link from "next/link";
import { isDynamicServerError } from "next/dist/client/components/hooks-server-context";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { AppNavbar } from "@/components/app-navbar";
import { ProfileBucketList } from "@/components/profile-bucket-list";
import { RaceJourney } from "@/components/race-journey";
import { StravaRacePortfolioSection } from "@/components/strava-race-portfolio-section";
import { Card } from "@/components/ui/card";
import { getServerAuthUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import { demoUser, isSupabaseConfigured } from "@/lib/demo-mode";
import { confirmedCompletedPortfolioRaces } from "@/lib/portfolio-race";
import { portfolioRaceHref } from "@/lib/profile-portfolio";
import { getRaceSceneImagePath } from "@/lib/race-scene-images";
import { runfolioLog } from "@/lib/runfolio-log";
import { getStravaFeed } from "@/lib/strava-feed";
import { fetchCanonicalBucketGoalsForUser } from "@/lib/bucket-list-canonical/queries";
import { raceCountsAsBucketListCompleted, raceIsBucketListFutureGoal } from "@/lib/bucket-list-model";
import { dedupeHighConfidenceDiscoverIds, enrichRaceCandidatesWithCatalogMatches } from "@/lib/strava-race-candidates";
import type { Race } from "@/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const stravaOAuthConfigured = Boolean(
    process.env.STRAVA_CLIENT_ID?.trim() && process.env.STRAVA_CLIENT_SECRET?.trim()
  );
  const stravaFeed = await getStravaFeed();

  let userName = demoUser.name;
  let races: Race[] = [];
  let canonicalFuture: Awaited<ReturnType<typeof fetchCanonicalBucketGoalsForUser>>["future"] = [];
  let canonicalCompleted: Awaited<ReturnType<typeof fetchCanonicalBucketGoalsForUser>>["completed"] = [];
  if (isSupabaseConfigured()) {
    try {
      const { user, authError } = await getServerAuthUser();
      if (authError) throw new Error(authError);
      if (!user) redirect("/auth/login");
      const supabase = await createClient();
      userName = user.user_metadata?.name ?? "Your Runfolio";
      const result = await supabase.from("races").select("*").eq("user_id", user.id).order("date", { ascending: false });
      if (result.error) {
        runfolioLog.warn("Dashboard.races", result.error.message ?? "query error");
        races = [];
      } else {
        races = result.data ?? [];
      }
      const canon = await fetchCanonicalBucketGoalsForUser(supabase, user.id);
      canonicalFuture = canon.future;
      canonicalCompleted = canon.completed;
    } catch (e) {
      if (isDynamicServerError(e)) throw e;
      if (isRedirectError(e)) throw e;
      runfolioLog.error("Dashboard.supabase", e);
      userName = demoUser.name;
      races = [];
    }
  }

  const completedSorted = [...confirmedCompletedPortfolioRaces(races ?? [])].sort((a, b) =>
    String(b.date ?? "").localeCompare(String(a.date ?? ""))
  );
  const future = (races ?? []).filter((race) => !race.is_completed);
  const futureGoalCount =
    future.filter(raceIsBucketListFutureGoal).length + canonicalFuture.length;
  const featured = completedSorted[0];
  const totalKm = completedSorted.reduce((acc, race) => acc + (race.distance_km ?? 0), 0);

  const stravaRaceEnriched = stravaFeed.ok
    ? enrichRaceCandidatesWithCatalogMatches(stravaFeed.raceCandidates, races ?? [])
    : [];
  const matchedMajorDiscoverIds = dedupeHighConfidenceDiscoverIds(stravaRaceEnriched);
  const recentlyCompletedCatalog = completedSorted
    .filter((r) => Boolean(r.discover_race_id))
    .slice(0, 6);

  return (
    <>
      <AppNavbar />
      <section className="hero-full min-h-[420px] md:min-h-[480px]">
        <div className="hero-bg" style={{ backgroundImage: "url('/photos/placeholders/9.png')" }} />
        <div className="hero-overlay" />
        <div className="hero-inner flex flex-col gap-10 pb-4 md:flex-row md:items-end md:justify-between md:pb-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:gap-10">
            <div
              className="h-28 w-28 shrink-0 rounded-full border-2 border-accent bg-cover bg-center shadow-[0_0_0_1px_rgba(232,122,61,0.35)]"
              style={{ backgroundImage: "url('/photos/placeholders/8.png')" }}
              role="img"
              aria-label="Profile"
            />
            <div>
              <p className="type-eyebrow">Runner Portfolio</p>
              <h1 className="type-display mt-3 max-w-[18ch] leading-[1.05]">{userName}</h1>
              <p className="type-tagline mt-3">Ultrarunner. Mountain Lover. Chaser of Big Days.</p>
              <p className="type-meta mt-4 flex items-center gap-2">
                <span className="text-accent" aria-hidden>
                  ◎
                </span>
                Colorado, USA
              </p>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300">
                A curated record of the races that shaped you—not every mile, only the ones that mattered.
              </p>
              <div className="mt-10 grid max-w-2xl grid-cols-3 gap-6 border-t border-white/10 pt-8">
                {[
                  { label: "Races", value: String(completedSorted.length) },
                  { label: "Continents", value: "2" },
                  { label: "Up next", value: String(future.length) }
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">{s.label}</p>
                    <p className="mt-2 text-3xl font-bold tabular-nums text-white">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-3 md:items-end">
            <Link
              href="/races/new"
              className="rounded-[12px] bg-accent px-4 py-2 text-center text-[13px] font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-[#f08a4d]"
            >
              Add Race
            </Link>
            <Link
              href="/races/new"
              className="rounded-[12px] border border-border bg-panelAlt px-4 py-2 text-center text-[13px] font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-slate-800"
            >
              Import from Strava
            </Link>
          </div>
        </div>
      </section>

      <main className="app-shell space-y-16">
        <section>
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="type-eyebrow">Highlights</p>
              <h2 className="type-section mt-2 text-lg md:text-xl">Race Highlights</h2>
            </div>
            <Link href="/races/new" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
              View all races
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {completedSorted.length === 0 ? (
              <Card className="col-span-full border-dashed border-white/15 bg-panel/40 p-8 text-center sm:col-span-2 lg:col-span-4">
                <p className="text-sm font-semibold text-white">No confirmed finishes yet</p>
                <p className="type-meta mx-auto mt-2 max-w-md text-xs">
                  Link a Strava activity or add a race with a catalog match so highlights reflect real finishes — not
                  placeholders.
                </p>
                <Link
                  href="/races/new"
                  className="mt-5 inline-block text-[11px] font-semibold uppercase tracking-[0.15em] text-accent hover:underline"
                >
                  Add or confirm a race →
                </Link>
              </Card>
            ) : (
              completedSorted.slice(0, 4).map((race, i) => (
                <Card
                  key={race.id}
                  className={`overflow-hidden p-0 ${i === 0 ? "border-accent ring-1 ring-accent/40" : ""}`}
                >
                  <div
                    className="aspect-[4/3] bg-cover bg-center"
                    style={{ backgroundImage: `url('${getRaceSceneImagePath(race.name)}')` }}
                  />
                  <div className="border-t border-border p-4">
                    <p className="font-semibold uppercase tracking-[0.04em] text-white">{race.name}</p>
                    <p className="type-meta mt-1 text-xs">
                      {race.distance_km} km · {race.elevation_m ?? "—"} m · {race.time ?? "—"}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-slate-300 line-clamp-2">
                      {race.description ?? "A day that stayed with you long after the finish."}
                    </p>
                  </div>
                </Card>
              ))
            )}
          </div>
        </section>

        <StravaRacePortfolioSection
          candidates={stravaRaceEnriched}
          raceCandidateStats={stravaFeed.raceCandidateStats}
          matchedMajorDiscoverIds={matchedMajorDiscoverIds}
          recentlyCompletedCatalog={recentlyCompletedCatalog}
          stravaOAuthConfigured={stravaOAuthConfigured}
          stravaOk={stravaFeed.ok}
        />

        <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 right-auto border-y border-border bg-[#05070c]">
          <div className="mx-auto w-full max-w-[1400px] border-x border-border">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
              <RaceJourney races={completedSorted} />
              <ProfileBucketList
                completed={completedSorted.filter(raceCountsAsBucketListCompleted)}
                future={future.filter(raceIsBucketListFutureGoal)}
                canonicalFuture={canonicalFuture}
                canonicalCompleted={canonicalCompleted}
              />
            </div>
          </div>
        </div>

        {featured ? (
          <section className="border border-border bg-panel/80">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,0.85fr)]">
              <div
                className="min-h-[320px] bg-cover bg-center lg:min-h-[480px]"
                style={{ backgroundImage: `url('${getRaceSceneImagePath(featured.name)}')` }}
              />
              <div className="border-border p-6 md:p-8 lg:border-l">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-2xl font-bold uppercase tracking-[0.04em] md:text-3xl">{featured.name}</h3>
                  <span className="border border-green/50 bg-green/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-green">
                    Completed
                  </span>
                </div>
                <p className="type-meta mt-2 uppercase tracking-wide">
                  {featured.location ?? "—"} · {featured.date ?? "—"}
                </p>
                <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { k: "Distance", v: `${featured.distance_km} km` },
                    { k: "Elevation", v: `${featured.elevation_m ?? "—"} m` },
                    { k: "Time", v: featured.time ?? "—" },
                    { k: "Place", v: "—" }
                  ].map((row) => (
                    <div key={row.k}>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">{row.k}</p>
                      <p className="mt-1 text-lg font-semibold text-white">{row.v}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-8 border-t border-border pt-6">
                  <p className="type-tagline text-base">&ldquo;One step at a time.&rdquo;</p>
                  <p className="mt-4 text-sm leading-relaxed text-slate-300">{featured.description ?? "The story of this race belongs here."}</p>
                  <p className="type-meta mt-6 text-xs">Highlight — the moment you knew you would finish.</p>
                </div>
              </div>
              <div className="border-t border-border p-6 lg:border-l lg:border-t-0 md:p-8">
                <p className="type-section text-sm">Linked finish</p>
                <div
                  className="mt-3 h-40 bg-cover bg-center"
                  style={{ backgroundImage: `url('${getRaceSceneImagePath(featured.name)}')` }}
                />
                <p className="type-meta mt-4 text-xs">
                  {featured.strava_activity_id
                    ? "Strava-linked — open your full race portfolio for photos and story."
                    : "Add a Strava match on Add race to unlock the activity portfolio page."}
                </p>
                {featured.strava_activity_id ? (
                  <Link
                    href={portfolioRaceHref(featured)}
                    className="mt-4 inline-block text-[11px] font-semibold uppercase tracking-[0.15em] text-accent hover:underline"
                  >
                    Open race portfolio →
                  </Link>
                ) : null}
                <div className="mt-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Splits</p>
                  <table className="mt-2 w-full text-left text-sm">
                    <thead>
                      <tr className="type-meta text-[11px]">
                        <th className="pb-2 font-normal">Point</th>
                        <th className="pb-2 font-normal">Distance</th>
                        <th className="pb-2 font-normal">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/80">
                      {["Start", "CP1", "CP2", "Finish"].map((pt, idx) => (
                        <tr key={pt}>
                          <td className="py-2 text-white">{pt}</td>
                          <td className="py-2 text-muted">{idx * 25} km</td>
                          <td className="py-2 text-muted">—</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto border-t border-border px-4 py-4">
              {completedSorted.slice(0, 6).map((race) => (
                <div
                  key={race.id}
                  className="h-16 w-28 shrink-0 bg-cover bg-center"
                  style={{ backgroundImage: `url('${getRaceSceneImagePath(race.name)}')` }}
                />
              ))}
            </div>
          </section>
        ) : null}

        <p className="type-tagline text-center text-lg">
          &ldquo;The mountain doesn&apos;t care who you are. It only reveals who you become.&rdquo;
        </p>
        <p className="type-meta text-center text-xs">— After the line</p>

        <section className="grid gap-4 border border-border bg-panel/50 p-6 md:grid-cols-3 md:p-8 lg:grid-cols-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Portfolio distance</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{totalKm.toFixed(1)} km</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Races logged</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{completedSorted.length}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Goals ahead</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{futureGoalCount}</p>
          </div>
          {stravaFeed.ok ? (
            <>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Race candidate km</p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-white">
                  {stravaFeed.raceCandidateStats.totalDistanceKm} km
                </p>
                <p className="type-meta mt-1 text-[10px]">≥21 km runs only</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Race candidates</p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-white">{stravaFeed.raceCandidateStats.activityCount}</p>
                <p className="type-meta mt-1 text-[10px]">{stravaFeed.stats.activityCount} total loaded</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Candidate elevation</p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-white">{stravaFeed.raceCandidateStats.totalElevationM} m</p>
              </div>
            </>
          ) : null}
        </section>
      </main>
    </>
  );
}
