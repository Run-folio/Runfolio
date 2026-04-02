import Link from "next/link";
import Image from "next/image";
import type { Race } from "@/types";
import { getRaceSceneImagePath } from "@/lib/race-scene-images";
import { portfolioRaceHref } from "@/lib/profile-portfolio";
import { rankRacesForProfileTopRaces, type TopRaceBadge } from "@/lib/top-race-rank";
import { cn } from "@/lib/utils";

function badgeClasses(tone: TopRaceBadge["tone"]): string {
  if (tone === "gold") return "border-gold/55 bg-black/65 text-gold";
  if (tone === "accent") return "border-accent/45 bg-black/65 text-accent";
  return "border-white/20 bg-black/55 text-muted";
}

function TopRaceCard({
  race,
  featured,
  rankLabel,
  badges,
  href
}: {
  race: Race;
  featured?: boolean;
  rankLabel?: string;
  badges: TopRaceBadge[];
  href: string;
}) {
  const isExternal = href.startsWith("http");
  const cardInner = (
    <>
      <div className="absolute right-2 top-2 z-20 flex max-w-[65%] flex-wrap justify-end gap-1">
        {rankLabel ? (
          <span className="border border-white/25 bg-black/70 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-white/90">
            {rankLabel}
          </span>
        ) : null}
        {badges.map((b) => (
          <span
            key={`${b.kind}-${b.label}`}
            className={cn(
              "px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider",
              badgeClasses(b.tone)
            )}
          >
            {b.label}
          </span>
        ))}
      </div>
      <div className="relative aspect-[4/3] w-full">
        <Image
          src={getRaceSceneImagePath(race.name)}
          alt={race.name}
          fill
          className="object-cover transition group-hover:scale-[1.02]"
          sizes="(max-width:768px) 100vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className={`font-display text-xl font-normal text-white md:text-2xl`}>{race.name}</h3>
          <p className="mt-1 text-xs text-white/65">
            {race.time ?? "—"} · {race.distance_km} km
            {race.elevation_m ? ` / ${race.elevation_m} m` : ""}
          </p>
          <p className="mt-2 font-display text-sm italic text-white/80 line-clamp-2">
            {race.description ?? "A finish that stayed with you."}
          </p>
        </div>
      </div>
    </>
  );

  const className = cn(
    "group relative flex flex-col overflow-hidden border border-border bg-[#0a0a0a] transition hover:border-accent/35",
    featured ? "z-10 scale-[1.04] shadow-[0_20px_50px_rgba(0,0,0,0.5)] md:-my-4" : "opacity-95"
  );

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {cardInner}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {cardInner}
    </Link>
  );
}

type Props = {
  /** Completed majors (DB + merged Strava high-confidence for owner). */
  completedRaces: Race[];
};

export function ProfileTopRaces({ completedRaces }: Props) {
  const ranked = rankRacesForProfileTopRaces(completedRaces);
  const a = ranked[1];
  const b = ranked[0];
  const c = ranked[2];
  const triple = [a, b, c].filter(Boolean) as typeof ranked;

  if (triple.length === 0) return null;

  return (
    <section className="border border-border bg-[#080a0e] px-5 py-8 md:px-8 md:py-10">
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white">Top Races</h2>
          <p className="type-meta mt-2 max-w-xl text-xs">
            Your defining efforts — ranked by prestige (majors, UTMB, hundreds), distance, vert, confirmed catalog
            matches, and story tags. Recency is a light tie-breaker, not the main signal.
          </p>
        </div>
        <Link href="/races/new" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold hover:text-white">
          Add / confirm race →
        </Link>
      </div>
      <div className="grid items-center gap-4 md:grid-cols-3">
        {triple.length >= 3 ? (
          <>
            <TopRaceCard
              race={triple[0].race}
              rankLabel="#2"
              badges={triple[0].badges}
              href={portfolioRaceHref(triple[0].race)}
            />
            <TopRaceCard
              race={triple[1].race}
              featured
              rankLabel="#1"
              badges={triple[1].badges}
              href={portfolioRaceHref(triple[1].race)}
            />
            <TopRaceCard
              race={triple[2].race}
              rankLabel="#3"
              badges={triple[2].badges}
              href={portfolioRaceHref(triple[2].race)}
            />
          </>
        ) : (
          triple.map((entry, i) => (
            <TopRaceCard
              key={entry.race.id}
              race={entry.race}
              featured={i === 1}
              rankLabel={`#${i + 1}`}
              badges={entry.badges}
              href={portfolioRaceHref(entry.race)}
            />
          ))
        )}
      </div>
    </section>
  );
}
