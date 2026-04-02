import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { AppNavbar } from "@/components/app-navbar";
import { raceIsBucketListFutureGoal, raceIsBucketListItem } from "@/lib/bucket-list-model";
import { getDiscoverRaceDetail, isDiscoverCatalogRaceId } from "@/lib/discover-race-details";
import { formatDiscoverDistance } from "@/lib/discover-races";
import { getRaceById } from "@/lib/get-race-by-id";
import { portfolioRaceHref } from "@/lib/profile-portfolio";
import { getServerAuthUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import { demoRaces, isSupabaseConfigured } from "@/lib/demo-mode";
import type { Race } from "@/types";

type Props = {
  params: Promise<{ raceId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { raceId } = await params;
  const d = getDiscoverRaceDetail(raceId);
  if (!d) return { title: "Race · Runfolio" };
  return { title: `${d.displayTitle} · Runfolio` };
}

function surfaceLabel(s: "road" | "trail" | "mixed"): string {
  if (s === "road") return "Road";
  if (s === "trail") return "Trail";
  return "Mixed";
}

export default async function RaceIdRouterPage({ params }: Props) {
  const { raceId } = await params;

  if (isDiscoverCatalogRaceId(raceId)) {
    const detail = getDiscoverRaceDetail(raceId);
    if (!detail) notFound();

    let userMatch: Race | null = null;
    let bucketFuture: Race | null = null;
    if (isSupabaseConfigured()) {
      try {
        const { user } = await getServerAuthUser();
        if (user?.id) {
          const supabase = await createClient();
          const { data } = await supabase
            .from("races")
            .select("*")
            .eq("user_id", user.id)
            .eq("discover_race_id", raceId)
            .eq("is_completed", true)
            .order("date", { ascending: false })
            .limit(1)
            .maybeSingle();
          userMatch = (data as Race | null) ?? null;

          const { data: openRows } = await supabase
            .from("races")
            .select("*")
            .eq("user_id", user.id)
            .eq("discover_race_id", raceId)
            .eq("is_completed", false);
          const incomplete = (openRows as Race[] | null) ?? [];
          bucketFuture = incomplete.find((r) => raceIsBucketListFutureGoal(r)) ?? null;
        }
      } catch {
        userMatch = null;
        bucketFuture = null;
      }
    } else {
      userMatch = demoRaces.find((r) => r.discover_race_id === raceId && r.is_completed) ?? null;
      bucketFuture =
        demoRaces.find(
          (r) => r.discover_race_id === raceId && !r.is_completed && raceIsBucketListFutureGoal(r)
        ) ?? null;
    }

    return (
      <>
        <AppNavbar />
        <section className="hero-full min-h-[320px] md:min-h-[380px]">
          <div className="hero-bg relative">
            <Image
              src={detail.heroImagePath}
              alt=""
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
          </div>
          <div className="hero-overlay" />
          <div className="hero-inner flex min-h-[320px] flex-col justify-end pb-10 md:min-h-[380px]">
            <Link href="/races/find" className="mb-6 w-fit text-[13px] font-medium text-white/80 transition hover:text-white">
              ← Find a race
            </Link>
            <p className="type-eyebrow text-accent">Runfolio race library</p>
            <h1 className="type-display mt-3 max-w-4xl">{detail.displayTitle}</h1>
            <p className="type-tagline mt-4 max-w-2xl text-white/85">{detail.location}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="border border-white/25 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                {detail.groupLabel}
              </span>
              <span className="border border-accent/50 bg-accent/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent">
                {surfaceLabel(detail.surface)}
              </span>
              <span className="border border-white/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                {formatDiscoverDistance(detail.distanceKm, detail.multiDay)}
              </span>
              {userMatch ? (
                <span className="border border-green-500/55 bg-green-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-green-300">
                  In your portfolio
                </span>
              ) : bucketFuture ? (
                <span className="border border-amber-500/45 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-200">
                  On your bucket list
                </span>
              ) : null}
            </div>
          </div>
        </section>

        <main className="app-shell space-y-10 pb-16">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="space-y-6">
              <div className="border border-white/10 bg-[#0a0a0a] p-6 md:p-8">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">About this race</h2>
                <p className="mt-4 text-base leading-relaxed text-white/90">{detail.shortDescription}</p>
              </div>
              <div className="border border-gold/30 bg-gradient-to-br from-gold/10 to-black/40 p-6 md:p-8">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold">Why it matters</h2>
                <p className="mt-4 text-sm leading-relaxed text-slate-200">{detail.prestige}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="border border-white/10 bg-[#0d0d0d] p-6">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Key stats</h2>
                <ul className="mt-4 space-y-3">
                  {detail.keyStats.map((row) => (
                    <li key={row.label} className="flex justify-between gap-4 border-b border-white/5 pb-3 text-sm last:border-0">
                      <span className="text-muted">{row.label}</span>
                      <span className="font-semibold text-white">{row.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border border-white/10 bg-[#0d0d0d] p-6">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Your Runfolio</h2>
                {userMatch ? (
                  <>
                    <p className="mt-3 text-sm text-slate-300">
                      You&apos;ve logged a confirmed finish for this event. It matches your profile, journey, and bucket
                      rules (bucket completed only if it was a bucket goal).
                    </p>
                    <Link
                      href={portfolioRaceHref(userMatch)}
                      className="mt-5 flex w-full items-center justify-center rounded-[12px] border border-gold/40 bg-gold/10 px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-gold transition hover:bg-gold/15"
                    >
                      Open your finish
                    </Link>
                    <Link
                      href={`/races/new?discover=${encodeURIComponent(raceId)}`}
                      className="mt-3 flex w-full items-center justify-center rounded-[12px] border border-white/15 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted transition hover:border-white/25 hover:text-white"
                    >
                      Log another year / edition
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="mt-3 text-sm text-slate-300">
                      Add this event to your portfolio or bucket list from Add race — we&apos;ll pre-fill distance and
                      location.
                    </p>
                    {bucketFuture ? (
                      <p className="mt-3 border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90">
                        This race is already on your bucket list as a future goal.
                      </p>
                    ) : null}
                    <Link
                      href={`/races/new?discover=${encodeURIComponent(raceId)}`}
                      className="mt-5 flex w-full items-center justify-center rounded-[12px] bg-accent px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-[#f08a4d]"
                    >
                      Add to portfolio / bucket list
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>

          {userMatch ? (
            <div className="border border-green-500/40 bg-green-950/25 p-6 md:p-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-400">You completed this</p>
              {raceIsBucketListItem(userMatch) ? (
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-gold">
                  Bucket list · completed (was on your list)
                </p>
              ) : (
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-white/60">
                  Confirmed finish · not counted toward bucket list completed (add via bucket first for that badge)
                </p>
              )}
              <p className="mt-3 text-lg font-semibold text-white">
                Logged as <span className="text-accent">{userMatch.name}</span>
                {userMatch.date ? ` · ${userMatch.date}` : null}
              </p>
              {userMatch.description ? (
                <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-white/85">
                  {userMatch.description}
                </p>
              ) : null}
              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted">Distance</dt>
                  <dd className="mt-1 font-semibold text-white">{userMatch.distance_km ?? "—"} km</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted">Time</dt>
                  <dd className="mt-1 font-semibold text-white">{userMatch.time ?? "—"}</dd>
                </div>
                <div className="sm:col-span-3">
                  <dt className="text-[10px] uppercase tracking-wider text-muted">Strava & portfolio</dt>
                  <dd className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                    {userMatch.strava_activity_id ? (
                      <>
                        <a
                          href={`https://www.strava.com/activities/${userMatch.strava_activity_id}`}
                          className="font-semibold text-accent hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open on Strava
                        </a>
                        <Link
                          href={`/activities/${userMatch.strava_activity_id}`}
                          className="font-semibold text-gold hover:underline"
                        >
                          Runfolio activity page →
                        </Link>
                      </>
                    ) : (
                      <span className="text-muted">No Strava link — manual or pre-Strava entry</span>
                    )}
                  </dd>
                </div>
              </dl>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={portfolioRaceHref(userMatch)}
                  className="rounded-[12px] border border-border bg-panelAlt px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-slate-800"
                >
                  {userMatch.strava_activity_id ? "Open race portfolio" : "Open your race story"}
                </Link>
                {userMatch.strava_activity_id ? (
                  <Link
                    href={`/races/${userMatch.id}/activity`}
                    className="rounded-[12px] border border-white/15 px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted transition hover:border-white/30 hover:text-white"
                  >
                    Classic race page
                  </Link>
                ) : null}
                <Link href="/races/new" className="rounded-[12px] px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted transition hover:text-white">
                  Add reflection / edit
                </Link>
              </div>
            </div>
          ) : (
            <p className="type-meta text-center text-sm">
              Haven&apos;t logged this one yet?{" "}
              <Link href={`/races/new?discover=${encodeURIComponent(raceId)}`} className="text-accent hover:underline">
                Start from this race template
              </Link>
              .
            </p>
          )}
        </main>
      </>
    );
  }

  const userRace = await getRaceById(raceId);
  if (!userRace) notFound();
  if (userRace.is_completed) redirect(`/races/${raceId}/activity`);
  redirect(`/races/${raceId}/info`);
}
