import Link from "next/link";
import Image from "next/image";
import type { Race } from "@/types";
import { formatRaceMonth } from "@/lib/format-race-date";
import { getPortfolioRaceLabel } from "@/lib/portfolio-race-label";
import { portfolioRaceHref } from "@/lib/profile-portfolio";
import { profileRaceHeroImage } from "@/lib/running-profile/race-presentational";
import { cn } from "@/lib/utils";
import { ProfileRaceCurationToolbar } from "@/components/running-profile/profile-race-curation-toolbar";
import { racePublishedOnProfile } from "@/lib/portfolio-race";

type Props = {
  races: Race[];
  isOwner?: boolean;
};

export function RunningProfileSpotlight({ races, isOwner }: Props) {
  const spotlight = races.filter((r) => r.profile_featured || r.tag_career_highlight);
  if (spotlight.length === 0) return null;

  return (
    <section className="border-x border-b border-border bg-[#06070a] px-5 py-10 md:px-8 md:py-12">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold/90">Spotlight</p>
          <h2 className="font-display mt-2 text-2xl font-normal text-white md:text-3xl">Moments that define the path</h2>
          <p className="type-meta mt-2 max-w-xl text-xs text-white/55">
            Featured finishes and career highlights.
          </p>
        </div>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {spotlight.map((race) => {
          const { src, alt } = profileRaceHeroImage(race);
          const href = portfolioRaceHref(race);
          const ext = href.startsWith("http");
          const label = getPortfolioRaceLabel(race);
          const month = formatRaceMonth(race.date);
          const published = racePublishedOnProfile(race);

          const media = (
            <div className="relative aspect-[16/10] w-full">
              <Image
                src={src}
                alt={alt}
                fill
                className="object-cover transition duration-500 group-hover:scale-[1.02]"
                sizes="(max-width:768px) 100vw, 50vw"
                unoptimized={src.startsWith("http")}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <h3 className="font-display text-xl font-normal text-white md:text-2xl">{label}</h3>
                <p className="mt-1 text-xs text-white/65">
                  {month ?? "—"} · {race.distance_km != null ? `${race.distance_km} km` : "—"}
                  {race.elevation_m ? ` · ${race.elevation_m} m` : ""}
                </p>
                {race.location ? <p className="mt-1 text-[11px] text-white/45">{race.location}</p> : null}
              </div>
            </div>
          );

          return (
            <li key={race.id}>
              <article
                className={cn(
                  "group overflow-hidden border border-gold/25 bg-[#0a0b10] shadow-[0_12px_40px_rgba(0,0,0,0.35)] transition hover:border-gold/40"
                )}
              >
                {ext ? (
                  <a href={href} target="_blank" rel="noreferrer" className="block">
                    {media}
                  </a>
                ) : (
                  <Link href={href} className="block">
                    {media}
                  </Link>
                )}
                {isOwner ? (
                  <div className="border-t border-white/10 bg-black/40 px-4 py-3">
                    <ProfileRaceCurationToolbar
                      raceId={race.id}
                      isPublished={published}
                      isFeatured={Boolean(race.profile_featured)}
                    />
                  </div>
                ) : null}
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
