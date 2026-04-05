import Link from "next/link";
import Image from "next/image";
import type { TrophySlotComputed } from "@/lib/collections/compute-slots";
import { portfolioRaceHref } from "@/lib/profile-portfolio";
import { cn } from "@/lib/utils";

type Props = {
  slots: TrophySlotComputed[];
};

export function TrophyCaseDetailSection({ slots }: Props) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2 border-b border-white/10 pb-6">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted">Collection roster</h2>
        <p className="max-w-2xl text-sm text-white/70">
          Every slot ties to your saved races — completed only after a confirmed catalog match (same source as your profile
          and race journey).
        </p>
      </div>
      <ul className="space-y-4">
        {slots.map((s) => {
          const done = Boolean(s.completedRace);
          const bucket = Boolean(!done && s.bucketRace);
          const catalogHref = `/races/${s.discoverId}`;
          const addHref = `/races/new?discover=${encodeURIComponent(s.discoverId)}`;
          const portfolioHref = s.completedRace ? portfolioRaceHref(s.completedRace) : null;

          return (
            <li
              key={s.discoverId}
              className="grid gap-4 border border-white/10 bg-[#0a0a0c] p-5 transition hover:border-white/15 md:grid-cols-[100px_minmax(0,1fr)_auto]"
            >
              <div className="relative mx-auto h-20 w-full max-w-[100px] overflow-hidden rounded-md border border-white/10 bg-black/40 md:mx-0">
                <Image src={s.heroImagePath} alt="" fill className="object-cover" sizes="100px" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-lg text-white">{s.displayTitle}</h3>
                  <span
                    className={cn(
                      "border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                      done && "border-gold/50 bg-gold/10 text-gold",
                      bucket && "border-amber-500/45 bg-amber-500/10 text-amber-200",
                      !done && !bucket && "border-white/15 text-muted"
                    )}
                  >
                    {done ? "Completed" : bucket ? "On bucket list" : "Not started"}
                  </span>
                </div>
                <p className="type-meta mt-1 text-sm text-white/60">
                  {s.location} · {s.distanceLabel} · {s.categoryLabel}
                </p>
                {done && s.completedRace ? (
                  <p className="mt-2 text-sm tabular-nums text-white/85">
                    {s.completedRace.time ?? "—"}
                    {s.completedRace.date ? ` · ${s.completedRace.date}` : ""}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 md:items-end md:justify-center">
                <Link
                  href={catalogHref}
                  className="whitespace-nowrap text-center text-[11px] font-semibold uppercase tracking-[0.15em] text-teal hover:text-teal-hover hover:underline"
                >
                  Race page
                </Link>
                {!done ? (
                  <Link
                    href={addHref}
                    className="whitespace-nowrap text-center text-[11px] font-semibold uppercase tracking-[0.15em] text-white/70 hover:text-white"
                  >
                    Add to bucket list
                  </Link>
                ) : null}
                {portfolioHref ? (
                  <Link
                    href={portfolioHref}
                    className="whitespace-nowrap text-center text-[11px] font-semibold uppercase tracking-[0.15em] text-gold hover:underline"
                  >
                    View finish
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
