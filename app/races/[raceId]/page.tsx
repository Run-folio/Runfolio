import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { AppNavbar } from "@/components/app-navbar";
import { getDiscoverRaceDetail, isDiscoverCatalogRaceId } from "@/lib/discover-race-details";
import { formatDiscoverDistance } from "@/lib/discover-races";
import { getRaceById } from "@/lib/get-race-by-id";
import { getServerAuthUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/demo-mode";
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
        }
      } catch {
        userMatch = null;
      }
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
                <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Bucket list</h2>
                <p className="mt-3 text-sm text-slate-300">
                  Add this event to your portfolio or bucket list from Add race — we&apos;ll pre-fill distance and
                  location.
                </p>
                <Link
                  href={`/races/new?discover=${encodeURIComponent(raceId)}`}
                  className="mt-5 flex w-full items-center justify-center rounded-[12px] bg-accent px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-[#f08a4d]"
                >
                  Add to portfolio / bucket list
                </Link>
              </div>
            </div>
          </div>

          {userMatch ? (
            <div className="border border-green-500/40 bg-green-950/25 p-6 md:p-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-400">You completed this</p>
              <p className="mt-3 text-lg font-semibold text-white">
                Logged as <span className="text-accent">{userMatch.name}</span>
                {userMatch.date ? ` · ${userMatch.date}` : null}
              </p>
              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted">Distance</dt>
                  <dd className="mt-1 font-semibold text-white">{userMatch.distance_km ?? "—"} km</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted">Time</dt>
                  <dd className="mt-1 font-semibold text-white">{userMatch.time ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted">Strava</dt>
                  <dd className="mt-1">
                    {userMatch.strava_activity_id ? (
                      <a
                        href={`https://www.strava.com/activities/${userMatch.strava_activity_id}`}
                        className="font-semibold text-accent hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        View activity
                      </a>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </dd>
                </div>
              </dl>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/races/${userMatch.id}/activity`}
                  className="rounded-[12px] border border-border bg-panelAlt px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-slate-800"
                >
                  Open your race story
                </Link>
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
