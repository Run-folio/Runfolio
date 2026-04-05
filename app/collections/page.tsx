import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { AppNavbar } from "@/components/app-navbar";
import { listTrophyCollectionSlugs, TROPHY_COLLECTIONS } from "@/lib/collections/registry";
import { getDiscoverRaceDetail } from "@/lib/discover-race-details";

export const metadata: Metadata = {
  title: "Trophy cases · Runfolio",
  description: "Iconic race collections — UTMB World Series, World Marathon Majors, and more."
};

export default function CollectionsIndexPage() {
  const slugs = listTrophyCollectionSlugs();

  return (
    <>
      <AppNavbar />
      <main className="min-h-screen bg-[#05070c] pb-20">
        <section className="border-b border-white/10 bg-gradient-to-b from-[#0c0e14] to-[#05070c] px-6 py-16 md:px-10 md:py-20">
          <p className="type-eyebrow text-gold">Trophy cases</p>
          <h1 className="type-display mt-4 max-w-3xl">Walls worth finishing</h1>
          <p className="type-tagline mt-4 max-w-2xl text-white/75">
            Curated sets of legendary races. Track what you&apos;ve earned, what&apos;s on your list, and what still calls
            your name — same data as your profile, journey, and bucket list.
          </p>
        </section>

        <div className="app-shell mx-auto mt-12 grid gap-8 md:grid-cols-2">
          {slugs.map((slug) => {
            const c = TROPHY_COLLECTIONS[slug];
            if (!c) return null;
            const previewId = c.discoverRaceIds[0];
            const hero = previewId ? getDiscoverRaceDetail(previewId)?.heroImagePath : "/reference/hero-1.png";
            return (
              <Link
                key={slug}
                href={`/collections/${slug}`}
                className="group relative overflow-hidden border border-white/10 bg-[#0a0a0c] transition hover:border-gold/35"
              >
                <div className="relative aspect-[21/9] w-full overflow-hidden">
                  <Image
                    src={hero ?? "/reference/hero-1.png"}
                    alt=""
                    fill
                    className="object-cover brightness-[0.55] transition duration-500 group-hover:brightness-75"
                    sizes="(max-width:768px) 100vw, 50vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/90">{c.eyebrow}</p>
                    <h2 className="mt-2 font-display text-2xl text-white md:text-3xl">{c.title}</h2>
                    <p className="type-meta mt-2 max-w-lg text-sm text-white/70">{c.subtitle}</p>
                    <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
                      Open trophy case →
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}
