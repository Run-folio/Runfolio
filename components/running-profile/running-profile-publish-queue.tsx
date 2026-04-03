import Link from "next/link";
import type { Race } from "@/types";
import { getPortfolioRaceLabel } from "@/lib/portfolio-race-label";
import { raceEligibleForProfilePublish, raceNeedsProfileRestore } from "@/lib/portfolio-race";
import { portfolioRaceHref } from "@/lib/profile-portfolio";
import { ProfileRaceCurationToolbar } from "@/components/running-profile/profile-race-curation-toolbar";

type Props = {
  allRaces: Race[];
};

/** Owner-only: linked finishes waiting to be published. */
export function RunningProfilePublishQueue({ allRaces }: Props) {
  const queue = allRaces.filter(raceEligibleForProfilePublish);
  const hidden = allRaces.filter(raceNeedsProfileRestore);
  if (queue.length === 0 && hidden.length === 0) return null;

  return (
    <section className="border-x border-b border-amber-500/20 bg-[#0d0a06] px-5 py-8 md:px-8">
      {queue.length > 0 ? (
        <>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/90">Ready for your profile</p>
          <h2 className="font-display mt-2 text-lg font-normal text-white md:text-xl">
            {queue.length} finish{queue.length === 1 ? "" : "es"} linked — not public yet
          </h2>
          <p className="type-meta mt-2 max-w-2xl text-xs text-white/55">
            Linked finishes stay private until you publish them.
          </p>
          <ul className="mt-6 space-y-4">
            {queue.map((race) => {
              const label = getPortfolioRaceLabel(race);
              const href = portfolioRaceHref(race);
              return (
                <li
                  key={race.id}
                  className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/25 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-display text-base text-white">{label}</p>
                    <p className="type-meta text-[11px] text-white/50">
                      {race.date ?? "—"}
                      {race.distance_km != null ? ` · ${race.distance_km} km` : ""}
                    </p>
                    <Link
                      href={href}
                      className="mt-2 inline-block text-[10px] font-semibold uppercase tracking-wider text-gold/90 hover:text-white"
                    >
                      Open finish →
                    </Link>
                  </div>
                  <ProfileRaceCurationToolbar raceId={race.id} isPublished={false} isFeatured={false} />
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {hidden.length > 0 ? (
        <div className={queue.length > 0 ? "mt-10 border-t border-white/10 pt-8" : ""}>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Hidden from profile</p>
          <p className="type-meta mt-2 text-xs text-white/50">Restore anytime — your story stays in your account.</p>
          <ul className="mt-4 space-y-3">
            {hidden.map((race) => {
              const label = getPortfolioRaceLabel(race);
              return (
                <li
                  key={race.id}
                  className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="font-display text-sm text-white">{label}</p>
                  <ProfileRaceCurationToolbar
                    raceId={race.id}
                    isPublished={false}
                    isFeatured={Boolean(race.profile_featured)}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
