import Link from "next/link";
import Image from "next/image";
import type { Race } from "@/types";
import { OVERVIEW_PATH } from "@/lib/app-paths";
import { formatRaceMonth } from "@/lib/format-race-date";
import { getPortfolioRaceLabel } from "@/lib/portfolio-race-label";
import { portfolioRaceHref } from "@/lib/profile-portfolio";
import { profileRaceHeroImage } from "@/lib/running-profile/race-presentational";
import { racePublishedOnProfile } from "@/lib/portfolio-race";
import { ProfileRaceCurationToolbar } from "@/components/running-profile/profile-race-curation-toolbar";

type Props = {
  races: Race[];
  isOwner?: boolean;
};

export function RunningProfileCompletedGrid({ races, isOwner }: Props) {
  if (races.length === 0) {
    return (
      <section
        id="profile-completed-races"
        tabIndex={-1}
        className="scroll-mt-24 border-x border-b border-border bg-[#07080d] px-5 py-14 md:px-8 md:py-16"
      >
        <div className="mx-auto max-w-lg text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/50">Completed races</p>
          <h2 className="font-display mt-3 text-2xl font-normal text-white">Your finishes belong here</h2>
          <p className="type-meta mt-4 text-sm leading-relaxed text-white/55">
            Link a Strava activity to a race from Overview, then tap{" "}
            <span className="text-white/90">Show on profile</span> when you&apos;re ready. Nothing goes public until
            you say so.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/my-races"
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold hover:text-white"
            >
              My Races →
            </Link>
            <Link
              href={OVERVIEW_PATH}
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50 hover:text-white/80"
            >
              Overview →
            </Link>
            <Link
              href="/races/find"
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50 hover:text-white/80"
            >
              Find a race →
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="profile-completed-races"
      tabIndex={-1}
      className="scroll-mt-24 border-x border-b border-border bg-[#07080d] px-5 py-10 md:px-8 md:py-12"
    >
      <div className="mb-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">Completed races</p>
        <h2 className="font-display mt-2 text-2xl font-normal text-white md:text-3xl">The start line, stretched across years</h2>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {races.map((race) => {
          const { src, alt } = profileRaceHeroImage(race);
          const href = portfolioRaceHref(race);
          const ext = href.startsWith("http");
          const label = getPortfolioRaceLabel(race);
          const month = formatRaceMonth(race.date);
          const published = racePublishedOnProfile(race);

          const media = (
            <div className="relative aspect-[4/3] w-full">
              <Image
                src={src}
                alt={alt}
                fill
                className="object-cover transition duration-500 group-hover:scale-[1.015]"
                sizes="(max-width:768px) 100vw, 33vw"
                unoptimized={src.startsWith("http")}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/15 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="font-display text-lg font-normal text-white md:text-xl">{label}</h3>
                <p className="mt-1 text-[11px] text-white/65">
                  {month ?? "—"} · {race.distance_km != null ? `${race.distance_km} km` : "—"}
                  {race.elevation_m ? ` · ${race.elevation_m} m` : ""}
                </p>
                {race.location ? <p className="mt-1 line-clamp-1 text-[10px] text-white/45">{race.location}</p> : null}
              </div>
            </div>
          );

          return (
            <li key={race.id}>
              <article className="group flex flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0a0b0f] transition hover:border-white/20">
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
                  <div className="border-t border-white/10 bg-black/30 px-3 pb-3 pt-0">
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
