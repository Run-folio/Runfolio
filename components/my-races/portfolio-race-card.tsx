"use client";

import Image from "next/image";
import Link from "next/link";
import { getDiscoverRaceDetail } from "@/lib/discover-race-details";
import { getPortfolioRaceLabel } from "@/lib/portfolio-race-label";
import { portfolioRaceHref } from "@/lib/profile-portfolio";
import { getRaceSceneImagePath } from "@/lib/race-scene-images";
import { Card } from "@/components/ui/card";
import type { Race } from "@/types";
import { cn } from "@/lib/utils";

function formatDistanceKm(km: number | null | undefined): string {
  if (km == null || Number.isNaN(km)) return "—";
  if (km >= 100) return `${Math.round(km)} km`;
  return `${km % 1 === 0 ? km : km.toFixed(1)} km`;
}

function formatRaceDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function portfolioRaceHeroSrc(race: Race): string {
  const manual = race.manual_photo_urls?.[0]?.trim();
  if (manual) return manual;
  const label = getPortfolioRaceLabel(race);
  const did = race.discover_race_id?.trim();
  if (did) {
    const d = getDiscoverRaceDetail(did);
    if (d?.heroImagePath) return d.heroImagePath;
  }
  return getRaceSceneImagePath(label);
}

function raceTags(race: Race): string[] {
  const tags: string[] = [];
  if (race.tag_pb) tags.push("PB");
  if (race.tag_hardest) tags.push("Hardest");
  if (race.tag_career_highlight) tags.push("Highlight");
  if (race.tag_bucket_list_done) tags.push("Bucket list");
  return tags;
}

function editRaceHref(race: Race): string {
  return `/races/${race.id}/activity`;
}

type Props = {
  race: Race;
  achievementEmphasis?: boolean;
};

export function PortfolioRaceCard({ race, achievementEmphasis }: Props) {
  const label = getPortfolioRaceLabel(race);
  const hero = portfolioRaceHeroSrc(race);
  const storyHref = portfolioRaceHref(race);
  const tags = raceTags(race);
  const isRemoteHero = /^https?:\/\//i.test(hero);

  return (
    <Card
      className={cn(
        "group flex flex-col overflow-hidden border bg-panel/35 p-0 transition",
        achievementEmphasis && race.is_completed
          ? "border-emerald-500/35 shadow-[0_0_0_1px_rgba(52,211,153,0.12)]"
          : "border-white/10 hover:border-white/16"
      )}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        {isRemoteHero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <Image src={hero} alt="" fill className="object-cover" sizes="(max-width:768px) 100vw, 33vw" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070c] via-[#05070c]/20 to-transparent" />
        {race.is_completed ? (
          <span className="absolute right-3 top-3 rounded-full border border-emerald-400/35 bg-emerald-950/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-100/95">
            Completed
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-display text-lg font-normal leading-snug tracking-tight text-white">{label}</h3>
          <p className="mt-1 text-sm text-white/55">
            {formatRaceDate(race.date)} · {formatDistanceKm(race.distance_km)}
          </p>
        </div>

        {tags.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <li
                key={t}
                className="rounded-md border border-white/12 bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/70"
              >
                {t}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-auto flex flex-col gap-2 pt-1">
          <Link
            href={storyHref}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-white/[0.12] text-[12px] font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-white/[0.18]"
          >
            View Story
          </Link>
          <Link
            href={editRaceHref(race)}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[12px] border border-border bg-panelAlt text-[12px] font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-slate-800"
          >
            Edit
          </Link>
        </div>
      </div>
    </Card>
  );
}
