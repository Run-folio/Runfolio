import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNavbar } from "@/components/app-navbar";
import { TrophyCaseDetailSection } from "@/components/trophy-case-detail-section";
import { TrophyCaseHero, type TrophyHeroPanel } from "@/components/trophy-case-hero";
import { collectionProgress, computeTrophySlots } from "@/lib/collections/compute-slots";
import { getTrophyCollection } from "@/lib/collections/registry";
import { getServerAuthUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/demo-mode";
import { portfolioRaceHref } from "@/lib/profile-portfolio";
import type { Race } from "@/types";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = getTrophyCollection(slug);
  if (!c) return { title: "Collection · Runfolio" };
  return { title: `${c.title} · Trophy case · Runfolio`, description: c.subtitle };
}

export default async function TrophyCollectionPage({ params }: Props) {
  const { slug } = await params;
  const collection = getTrophyCollection(slug);
  if (!collection) notFound();

  let userRaces: Race[] = [];
  if (isSupabaseConfigured()) {
    const { user } = await getServerAuthUser();
    if (user?.id) {
      const supabase = await createClient();
      const { data } = await supabase
        .from("races")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });
      userRaces = (data as Race[]) ?? [];
    }
  }

  const slots = computeTrophySlots(userRaces, collection.discoverRaceIds);
  const { completed, total, bucketed } = collectionProgress(slots);

  const panels: TrophyHeroPanel[] = slots.map((s) => {
    const status = s.completedRace ? "completed" : s.bucketRace ? "bucket" : "locked";
    const teaser =
      s.completedRace && (s.completedRace.time || s.completedRace.date)
        ? [s.completedRace.time, s.completedRace.date].filter(Boolean).join(" · ")
        : null;
    return {
      discoverId: s.discoverId,
      displayTitle: s.displayTitle,
      location: s.location,
      distanceLabel: s.distanceLabel,
      heroImagePath: s.heroImagePath,
      logoPath: s.logoPath,
      status,
      catalogHref: `/races/${s.discoverId}`,
      portfolioHref: s.completedRace ? portfolioRaceHref(s.completedRace) : null,
      activityTeaser: teaser
    };
  });

  const nextTarget = slots.find((s) => !s.completedRace);

  return (
    <>
      <AppNavbar />
      <main className="min-h-screen bg-[#05070c] pb-24">
        <div className="border-b border-white/10 bg-black/40 px-6 py-6 md:px-10">
          <Link
            href="/collections"
            className="text-[12px] font-medium text-white/60 transition hover:text-white"
          >
            ← All trophy cases
          </Link>
          <p className="type-eyebrow mt-6 text-gold">{collection.eyebrow}</p>
          <h1 className="type-display mt-3 max-w-4xl">{collection.title}</h1>
          <p className="type-tagline mt-4 max-w-3xl text-white/78">{collection.subtitle}</p>
        </div>

        <div className="px-0 pt-0">
          <TrophyCaseHero panels={panels} />
        </div>

        <div className="app-shell mt-12 space-y-10">
          <section className="border border-white/10 bg-gradient-to-br from-[#0f1118] to-[#080a10] px-6 py-8 md:px-10 md:py-10">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted">Collection progress</p>
                <p className="mt-3 font-display text-4xl tabular-nums text-white md:text-5xl">
                  {completed}
                  <span className="text-white/35"> / {total}</span>
                </p>
                <p className="type-meta mt-2 text-sm text-white/65">Legendary finishes logged in Runfolio</p>
              </div>
              <div className="flex flex-col gap-3 lg:max-w-md lg:text-right">
                <p className="text-sm text-white/70">
                  <span className="font-semibold text-amber-200/90">{bucketed}</span> on your bucket list ·{" "}
                  <span className="font-semibold text-white">{total - completed - bucketed}</span> still open
                </p>
                {nextTarget && completed < total ? (
                  <p className="text-xs text-muted">
                    Next open slot:{" "}
                    <Link href={`/races/${nextTarget.discoverId}`} className="text-accent hover:underline">
                      {nextTarget.displayTitle}
                    </Link>
                  </p>
                ) : completed === total ? (
                  <p className="text-xs font-semibold uppercase tracking-wider text-gold">Collection complete</p>
                ) : null}
              </div>
            </div>
            <div className="mt-8 h-2 w-full overflow-hidden rounded-full bg-black/60 ring-1 ring-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold/90 via-accent to-gold/80 shadow-[0_0_24px_rgba(212,175,55,0.35)] transition-[width] duration-700"
                style={{ width: `${total > 0 ? Math.round((completed / total) * 100) : 0}%` }}
              />
            </div>
          </section>

          <TrophyCaseDetailSection slots={slots} />
        </div>
      </main>
    </>
  );
}
