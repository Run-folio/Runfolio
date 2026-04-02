"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type TrophyHeroPanel = {
  discoverId: string;
  displayTitle: string;
  location: string;
  distanceLabel: string;
  heroImagePath: string;
  logoPath: string;
  status: "locked" | "bucket" | "completed";
  catalogHref: string;
  portfolioHref: string | null;
  activityTeaser: string | null;
};

type Props = {
  panels: TrophyHeroPanel[];
};

export function TrophyCaseHero({ panels }: Props) {
  return (
    <div className="relative w-full overflow-hidden border border-white/10 bg-[#050508] shadow-[0_0_80px_rgba(0,0,0,0.45)]">
      <div className="flex min-h-[min(52vh,520px)] w-full flex-col md:flex-row md:min-h-[min(48vh,480px)]">
        {panels.map((p) => (
          <div
            key={p.discoverId}
            className={cn(
              "group relative flex min-h-[200px] flex-1 flex-col border-b border-white/10 md:min-h-0 md:border-b-0 md:border-r md:last:border-r-0",
              p.status === "completed" && "md:shadow-[inset_0_0_60px_rgba(212,175,55,0.12)]",
              p.status === "bucket" && "md:shadow-[inset_0_0_40px_rgba(251,191,36,0.08)]"
            )}
          >
            <Link
              href={p.catalogHref}
              className="relative flex min-h-[inherit] flex-1 flex-col outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <div className="absolute inset-0 overflow-hidden">
                <Image
                  src={p.heroImagePath}
                  alt=""
                  fill
                  className={cn(
                    "object-cover transition duration-500 ease-out",
                    p.status === "locked" &&
                      "brightness-[0.38] saturate-[0.65] group-hover:brightness-[0.72] group-hover:saturate-100",
                    p.status === "bucket" &&
                      "brightness-[0.48] saturate-[0.8] group-hover:brightness-[0.85] group-hover:saturate-100",
                    p.status === "completed" &&
                      "brightness-[0.92] saturate-100 contrast-[1.05] group-hover:brightness-100"
                  )}
                  sizes="(max-width:768px) 100vw, 16vw"
                  priority={panels.indexOf(p) < 2}
                />
                <div
                  className={cn(
                    "absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/25 transition duration-500",
                    p.status === "completed" && "via-black/40",
                    p.status === "locked" && "group-hover:via-black/35",
                    p.status === "bucket" && "group-hover:via-black/30"
                  )}
                />
                {p.status === "completed" ? (
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-gold/90 to-transparent opacity-90" />
                ) : null}
              </div>

              <div className="relative z-[1] mt-auto flex flex-col gap-3 p-4 md:p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-sm border border-white/15 bg-black/50 p-1">
                    <Image src={p.logoPath} alt="" width={48} height={32} className="max-h-8 w-auto object-contain" />
                  </div>
                  {p.status === "completed" ? (
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/60 bg-gold/20 text-gold shadow-[0_0_20px_rgba(212,175,55,0.35)]"
                      aria-label="Completed"
                    >
                      <span className="text-sm font-bold">✓</span>
                    </span>
                  ) : p.status === "bucket" ? (
                    <span className="border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.15em] text-amber-200/95">
                      On list
                    </span>
                  ) : (
                    <span className="border border-white/10 bg-black/40 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.15em] text-white/35">
                      Open
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-display text-base font-normal leading-tight text-white drop-shadow md:text-lg">
                    {p.displayTitle}
                  </p>
                  <p className="type-meta mt-1 text-[11px] text-white/55">{p.location}</p>
                  <p className="type-meta mt-0.5 text-[10px] uppercase tracking-wider text-white/40">{p.distanceLabel}</p>
                  {p.activityTeaser ? (
                    <p className="mt-2 text-[11px] font-medium tabular-nums text-gold/90">{p.activityTeaser}</p>
                  ) : null}
                </div>
              </div>
            </Link>

            {p.portfolioHref ? (
              <Link
                href={p.portfolioHref}
                className="absolute right-3 top-3 z-[2] border border-white/20 bg-black/70 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-sm transition hover:border-gold/50 hover:text-gold"
              >
                Portfolio
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
