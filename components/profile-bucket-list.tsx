import Link from "next/link";
import Image from "next/image";
import type { Race } from "@/types";
import { formatRaceMonth } from "@/lib/format-race-date";
import { getRaceLogoPath } from "@/lib/race-logos";
import { cn } from "@/lib/utils";

function BucketRaceCard({
  race,
  variant
}: {
  race: Race;
  variant: "completed" | "future";
}) {
  const month = formatRaceMonth(race.date);
  const src = getRaceLogoPath(race.name);

  const href =
    variant === "completed" ? `/races/${race.id}/activity` : `/races/${race.id}/info`;

  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col border border-white/10 bg-[#0d0d0d] transition hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]/45"
      )}
    >
      <div
        className={cn(
          "flex h-[72px] w-full items-center justify-center border-b border-white/10 px-2 py-2",
          variant === "completed" ? "bg-[#121212]" : "bg-[#0f0f0f]"
        )}
      >
        <Image
          src={src}
          alt=""
          width={120}
          height={56}
          className={cn(
            "h-12 w-auto max-w-[90%] object-contain transition group-hover:brightness-110",
            variant === "completed" && "brightness-110 contrast-95"
          )}
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-center text-[12px] font-semibold leading-tight text-white">{race.name}</p>
        {variant === "completed" && month ? (
          <p className="text-center text-[11px] text-muted">
            <span className="inline-flex items-center justify-center gap-1 text-[#d4af37]">
              <span className="text-[7px]">●</span> {month}
            </span>
          </p>
        ) : null}
      </div>
    </Link>
  );
}

type Props = {
  completed: Race[];
  future: Race[];
};

export function ProfileBucketList({ completed, future }: Props) {
  return (
    <section className="flex h-full flex-col border border-border bg-[#0a0a0a]">
      <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white">Bucket List</h2>
        <Link
          href="/races/new"
          className="inline-flex w-fit items-center justify-center rounded-[12px] border border-white/40 bg-transparent px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-white/5"
        >
          + Add Races
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-8 p-5 md:p-6">
        <div>
          <div className="mb-4 flex items-center gap-2">
            <span className="text-[#4ade80]" aria-hidden>
              ✓
            </span>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#4ade80]">Completed</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {completed.slice(0, 3).map((race) => (
              <BucketRaceCard key={race.id} race={race} variant="completed" />
            ))}
          </div>
          {completed.length === 0 ? (
            <p className="text-sm text-muted">No completed bucket list races yet.</p>
          ) : null}
        </div>

        <div>
          <div className="mb-4 flex items-center gap-2">
            <span className="text-[#c85a4a]" aria-hidden>
              ◎
            </span>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#c85a4a]">Yet To Do</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {future.map((race) => (
              <BucketRaceCard key={race.id} race={race} variant="future" />
            ))}
          </div>
          {future.length === 0 ? (
            <p className="text-sm text-muted">Your future goals will show up here.</p>
          ) : null}
        </div>
      </div>

      <p className="font-display border-t border-white/10 px-6 py-6 text-right text-lg italic text-[#d4af37] md:text-xl">
        &ldquo;The list keeps me hungry.&rdquo;
      </p>
    </section>
  );
}
