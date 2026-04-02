import Image from "next/image";
import Link from "next/link";
import type { Race } from "@/types";
import { getRaceSceneImagePath } from "@/lib/race-scene-images";
import { portfolioRaceHref } from "@/lib/profile-portfolio";

function groupByYear(races: Race[]): { year: string; items: Race[] }[] {
  const map = new Map<string, Race[]>();
  for (const r of races) {
    const y = r.date ? String(r.date).slice(0, 4) : "—";
    if (!map.has(y)) map.set(y, []);
    map.get(y)!.push(r);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([year, items]) => ({ year, items: items.sort((a, b) => String(b.date).localeCompare(String(a.date))) }));
}

type Props = {
  /** Includes completed (DB + Strava-merged) for timeline; incomplete rows ignored. */
  races: Race[];
};

function JourneyRow({ race }: { race: Race }) {
  const href = portfolioRaceHref(race);
  const external = href.startsWith("http");
  const inner = (
    <>
      <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md">
        <Image
          src={getRaceSceneImagePath(race.name)}
          alt={race.name}
          fill
          className="object-cover"
          sizes="80px"
        />
      </div>
      <div className="min-w-0 flex-1 border-b border-border/50 pb-4">
        <p className="font-semibold text-white">{race.name}</p>
        <p className="text-sm text-muted">{race.location ?? "—"}</p>
        {race.id.startsWith("strava-virt-") ? (
          <p className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-accent">Strava major · confirm to save</p>
        ) : null}
      </div>
      <p className="shrink-0 text-sm tabular-nums text-white/90">{race.time ?? "—"}</p>
    </>
  );

  if (external) {
    return (
      <li className="relative flex gap-4 pl-6 md:pl-8">
        <span className="absolute left-0 top-3 h-2 w-2 rounded-full bg-gold md:left-1" aria-hidden />
        <a href={href} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 gap-4 transition hover:opacity-90">
          {inner}
        </a>
      </li>
    );
  }

  return (
    <li className="relative flex gap-4 pl-6 md:pl-8">
      <span className="absolute left-0 top-3 h-2 w-2 rounded-full bg-gold md:left-1" aria-hidden />
      <Link href={href} className="flex min-w-0 flex-1 gap-4 transition hover:opacity-90">
        {inner}
      </Link>
    </li>
  );
}

export function RaceJourney({ races }: Props) {
  const completed = [...races].filter((r) => r.is_completed).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const groups = groupByYear(completed);

  return (
    <section className="border border-border bg-[#0a0a0a] px-5 py-8 md:px-6 md:py-8">
      <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white">Race Journey</h2>
      <p className="type-meta mt-2 text-xs">
        Major finishes over time — catalog-linked when we know the event, Strava-linked for high-confidence matches not yet saved.
      </p>
      <div className="relative mt-8 pl-4 md:pl-6">
        <div className="absolute bottom-2 left-[7px] top-2 w-px bg-gold/50 md:left-[11px]" aria-hidden />
        <div className="space-y-10">
          {groups.map(({ year, items }) => (
            <div key={year} className="relative">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-gold">{year}</p>
              <ul className="space-y-6">
                {items.map((race) => (
                  <JourneyRow key={race.id} race={race} />
                ))}
              </ul>
            </div>
          ))}
        </div>
        {groups.length === 0 ? <p className="text-sm text-muted">No major races on your timeline yet.</p> : null}
      </div>
    </section>
  );
}
