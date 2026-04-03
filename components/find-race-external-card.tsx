"use client";

import type { NormalizedRace } from "@/lib/races/types/normalized";
import { cn } from "@/lib/utils";

const SOURCE_LABEL: Record<string, string> = {
  runsignup: "RunSignup",
  mock: "Mock",
  active: "ACTIVE",
  chronotrack: "ChronoTrack",
  raceresult: "Race Result"
};

type Props = {
  race: NormalizedRace;
};

/**
 * Registry-sourced row (no `discover_race_id`). Bucket list from search will use `internalRaceId` + mapping later.
 */
export function FindRaceExternalCard({ race }: Props) {
  const href = race.registrationUrl ?? race.officialUrl;
  const dist =
    race.distanceKm != null ? `${race.distanceKm % 1 === 0 ? race.distanceKm : race.distanceKm.toFixed(1)} km` : null;
  const when = race.startDate ?? "Date TBD";
  const where = [race.city, race.region, race.country].filter(Boolean).join(", ") || "—";

  return (
    <li
      className={cn(
        "flex flex-col rounded-lg border border-white/10 bg-[#0d0d0f] p-4 transition hover:border-accent/25",
        "ring-1 ring-transparent focus-within:ring-accent/30"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="border border-white/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted">
          {SOURCE_LABEL[race.source] ?? race.source}
        </span>
      </div>
      <p className="mt-2 font-semibold text-white">{race.name}</p>
      <p className="type-meta mt-1 text-xs text-muted">{where}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {dist ? (
          <span className="border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
            {dist}
          </span>
        ) : null}
        <span className="border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
          {when}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-3">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="rounded-[10px] border border-accent/45 bg-accent/15 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent transition hover:bg-accent/25"
          >
            Register / official site
          </a>
        ) : null}
        <button
          type="button"
          disabled
          title="Coming soon: save registry races to your bucket list once we map them to your library."
          className="cursor-not-allowed rounded-[10px] border border-white/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted opacity-60"
        >
          Add to bucket list
        </button>
      </div>
    </li>
  );
}
