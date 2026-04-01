import Link from "next/link";
import Image from "next/image";
import type { Race } from "@/types";
import { getRaceSceneImagePath } from "@/lib/race-scene-images";
import { cn } from "@/lib/utils";

function TopRaceCard({
  race,
  featured,
  badge
}: {
  race: Race;
  featured?: boolean;
  badge?: "pr" | "highlight";
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden border border-border bg-[#0a0a0a]",
        featured ? "z-10 scale-[1.04] shadow-[0_20px_50px_rgba(0,0,0,0.5)] md:-my-4" : "opacity-95"
      )}
    >
      {badge === "pr" ? (
        <span className="absolute right-2 top-2 z-20 border border-gold/60 bg-black/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-gold">
          ★ PR
        </span>
      ) : null}
      {badge === "highlight" ? (
        <span className="absolute left-2 top-2 z-20 border border-gold/60 bg-black/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-gold">
          ★ Career Highlight
        </span>
      ) : null}
      <div className="relative aspect-[4/3] w-full">
        <Image
          src={getRaceSceneImagePath(race.name)}
          alt={race.name}
          fill
          className="object-cover"
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
            {race.description ?? "The finish line stayed with me long after."}
          </p>
        </div>
      </div>
    </div>
  );
}

type Props = {
  races: Race[];
};

export function ProfileTopRaces({ races }: Props) {
  const sorted = [...races].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const a = sorted[1];
  const b = sorted[0];
  const c = sorted[2];
  const triple = [a, b, c].filter(Boolean) as Race[];

  if (triple.length === 0) return null;

  return (
    <section className="border border-border bg-[#080a0e] px-5 py-8 md:px-8 md:py-10">
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white">Top Races</h2>
        <Link href="/races/new" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold hover:text-white">
          View All Races →
        </Link>
      </div>
      <div className="grid items-center gap-4 md:grid-cols-3">
        {triple.length >= 3 ? (
          <>
            <TopRaceCard race={triple[0]} badge="pr" />
            <TopRaceCard race={triple[1]} featured badge="highlight" />
            <TopRaceCard race={triple[2]} />
          </>
        ) : (
          triple.map((r, i) => <TopRaceCard key={r.id} race={r} featured={i === 1} badge={i === 0 ? "pr" : i === 1 ? "highlight" : undefined} />)
        )}
      </div>
    </section>
  );
}
