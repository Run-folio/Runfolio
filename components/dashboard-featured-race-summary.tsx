"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getPortfolioRaceLabel } from "@/lib/portfolio-race-label";
import { portfolioRaceHref } from "@/lib/profile-portfolio";
import { getRaceSceneImagePath } from "@/lib/race-scene-images";
import type { Race } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  races: Race[];
};

function heroSrc(race: Race): string {
  const manual = race.manual_photo_urls?.[0]?.trim();
  return manual || getRaceSceneImagePath(getPortfolioRaceLabel(race));
}

function CrossfadeHero({ imageUrl, className }: { imageUrl: string; className?: string }) {
  const [a, setA] = useState(imageUrl);
  const [b, setB] = useState(imageUrl);
  const [showA, setShowA] = useState(true);

  useEffect(() => {
    const active = showA ? a : b;
    if (imageUrl === active) return;
    if (showA) {
      setB(imageUrl);
      setShowA(false);
    } else {
      setA(imageUrl);
      setShowA(true);
    }
  }, [imageUrl, showA, a, b]);

  return (
    <div className={cn("relative size-full min-h-0 overflow-hidden bg-black/40", className)}>
      <img
        src={a}
        alt=""
        className={cn(
          "absolute inset-0 size-full object-cover transition-opacity duration-500 ease-out",
          showA ? "z-[1] opacity-100" : "z-0 opacity-0"
        )}
      />
      <img
        src={b}
        alt=""
        className={cn(
          "absolute inset-0 size-full object-cover transition-opacity duration-500 ease-out",
          !showA ? "z-[1] opacity-100" : "z-0 opacity-0"
        )}
      />
    </div>
  );
}

export function DashboardFeaturedRaceSummary({ races }: Props) {
  const initial = races[0];
  const [selectedId, setSelectedId] = useState(initial?.id ?? "");
  const [hoverId, setHoverId] = useState<string | null>(null);

  const selectedRace = races.find((r) => r.id === selectedId) ?? initial;
  const hoverRace = hoverId ? races.find((r) => r.id === hoverId) : null;
  const displayRace = hoverRace ?? selectedRace;

  const portfolioHref = selectedRace ? portfolioRaceHref(selectedRace) : "/races/new";

  if (!initial || !selectedRace) return null;

  const label = getPortfolioRaceLabel(selectedRace);
  const heroUrl = heroSrc(displayRace);

  const setDesktopHover = (id: string | null) => {
    if (typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      setHoverId(id);
    }
  };

  const PortfolioAnchor = ({
    className,
    children
  }: {
    className?: string;
    children: ReactNode;
  }) => {
    const ext = portfolioHref.startsWith("http");
    if (ext) {
      return (
        <a href={portfolioHref} target="_blank" rel="noreferrer" className={className}>
          {children}
        </a>
      );
    }
    return (
      <Link href={portfolioHref} className={className}>
        {children}
      </Link>
    );
  };

  return (
    <section className="border border-border bg-panel/80">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(0,0.72fr)]">
        <div className="flex min-h-0 flex-col border-border lg:border-r">
          <PortfolioAnchor className="group relative isolate block aspect-[4/5] w-full max-h-[580px] min-h-[260px] shrink-0 sm:aspect-[3/4] lg:max-h-[min(92vh,620px)] lg:min-h-[min(48vh,520px)]">
            <CrossfadeHero imageUrl={heroUrl} className="absolute inset-0" />
            <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black/75 via-black/25 to-transparent transition duration-300 group-hover:from-black/80" />
          </PortfolioAnchor>

          <div className="flex gap-2.5 overflow-x-auto border-t border-border px-3 py-3 [-webkit-overflow-scrolling:touch] sm:px-4 sm:py-3.5">
            {races.map((race) => {
              const active = race.id === selectedId;
              const thumb = heroSrc(race);
              return (
                <button
                  key={race.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(race.id);
                    setHoverId(null);
                  }}
                  onMouseEnter={() => setDesktopHover(race.id)}
                  onMouseLeave={() => setHoverId(null)}
                  onFocus={() => setDesktopHover(race.id)}
                  onBlur={() => setHoverId(null)}
                  className={cn(
                    "relative h-14 w-[4.5rem] shrink-0 overflow-hidden rounded-md transition duration-200 ease-out ring-2",
                    "hover:z-10 hover:scale-[1.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070c]",
                    active ? "ring-accent shadow-[0_0_0_1px_rgba(212,175,55,0.45)]" : "ring-white/15 hover:ring-accent/45"
                  )}
                  aria-label={`Show ${getPortfolioRaceLabel(race)}`}
                  aria-pressed={active}
                >
                  <img src={thumb} alt="" className="size-full object-cover" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-border p-6 md:p-8 lg:border-r">
          <PortfolioAnchor className="block outline-none transition hover:opacity-95 focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-accent">
            <h3 className="text-xl font-bold uppercase tracking-[0.04em] text-white md:text-2xl lg:text-3xl">{label}</h3>
          </PortfolioAnchor>
          <span className="mt-3 inline-flex rounded-full border border-green/45 bg-green/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-green">
            Completed
          </span>
          <p className="type-meta mt-3 uppercase tracking-wide">
            {[selectedRace.location, selectedRace.date].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4 lg:grid-cols-3">
            {[
              { k: "Distance", v: selectedRace.distance_km != null ? `${selectedRace.distance_km} km` : null },
              { k: "Elevation", v: selectedRace.elevation_m != null ? `${selectedRace.elevation_m} m` : null },
              { k: "Time", v: selectedRace.time?.trim() || null }
            ]
              .filter((row): row is { k: string; v: string } => row.v != null)
              .map((row) => (
                <div key={row.k}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">{row.k}</p>
                  <p className="mt-1 text-lg font-semibold text-white">{row.v}</p>
                </div>
              ))}
          </div>
          {selectedRace.description?.trim() ? (
            <div className="mt-8 border-t border-border pt-6">
              <p className="text-sm leading-relaxed text-slate-300">{selectedRace.description}</p>
            </div>
          ) : null}
        </div>

        <div className="border-t border-border p-6 md:p-8 lg:border-t-0">
          <p className="type-section text-sm text-white/90">Your finish</p>
          <p className="type-meta mt-3 text-xs leading-relaxed text-slate-400">
            {selectedRace.strava_activity_id
              ? "Strava-linked — open your full race portfolio for story, photos, and route."
              : "Link Strava when you add a race to unlock the full activity portfolio."}
          </p>
          <div className="mt-6">
            <PortfolioAnchor className="inline-flex min-h-[48px] items-center justify-center rounded-[12px] border border-accent/45 bg-accent/15 px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-accent transition hover:bg-accent/25">
              View race
            </PortfolioAnchor>
          </div>
        </div>
      </div>
    </section>
  );
}
