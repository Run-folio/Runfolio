import Image from "next/image";
import Link from "next/link";
import type { Race } from "@/types";
import { getPortfolioRaceLabel } from "@/lib/portfolio-race-label";
import { getRaceSceneImagePath } from "@/lib/race-scene-images";
import { portfolioRaceHref } from "@/lib/profile-portfolio";
import { cn } from "@/lib/utils";

type Props = {
  /** Profile-approved completed majors not in the Top Races triple. */
  races: Race[];
};

export function ProfileConfirmedMajorRaces({ races }: Props) {
  if (races.length === 0) return null;

  return (
    <section className="border-x border-b border-border bg-[#06080f] px-5 py-8 md:px-8 md:py-10">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-400/90">Confirmed majors</p>
          <h2 className="type-section mt-2 text-base text-white md:text-lg">Rest of your curated portfolio</h2>
          <p className="type-meta mt-2 max-w-2xl text-xs">
            These finishes are approved for your public profile. Your top three highlights stay above; everything else
            lives here and in Race Journey.
          </p>
        </div>
      </div>
      <ul className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-4">
        {races.map((race) => {
          const href = portfolioRaceHref(race);
          const ext = href.startsWith("http");
          const label = getPortfolioRaceLabel(race);
          const card = (
            <div
              className={cn(
                "group flex min-w-[200px] flex-1 overflow-hidden border border-white/10 bg-[#0d0d0f] transition hover:border-green-500/35 md:min-w-0"
              )}
            >
              <div className="relative h-20 w-24 shrink-0">
                <Image
                  src={getRaceSceneImagePath(label)}
                  alt=""
                  fill
                  className="object-cover transition group-hover:brightness-110"
                  sizes="96px"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2">
                <p className="truncate text-sm font-semibold text-white">{label}</p>
                <p className="type-meta truncate text-[11px]">{race.date ?? "—"}</p>
              </div>
            </div>
          );
          return (
            <li key={race.id} className="shrink-0 md:shrink">
              {ext ? (
                <a href={href} target="_blank" rel="noreferrer" className="block">
                  {card}
                </a>
              ) : (
                <Link href={href} className="block">
                  {card}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
