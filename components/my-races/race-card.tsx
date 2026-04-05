"use client";

import Link from "next/link";
import type { CanonicalStravaSuggestion } from "@/lib/strava-canonical-match/suggestions";
import { parseActivityPageId } from "@/lib/activity-route-id";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function activityLinks(stravaActivityId: string): { stravaUrl: string | null; portfolioPath: string } {
  const raw = stravaActivityId.trim();
  const p = parseActivityPageId(raw);
  return {
    portfolioPath: `/activities/${encodeURIComponent(raw)}`,
    stravaUrl: p?.kind === "file_import" ? null : `https://www.strava.com/activities/${raw}`
  };
}

function formatActivityStatLine(input: {
  date: string;
  km: number;
  el: number | null | undefined;
}): string {
  return [input.date, input.km ? `${input.km} km` : "—", input.el != null && input.el > 0 ? `${Math.round(input.el)} m` : null]
    .filter(Boolean)
    .join(" · ");
}

function confidenceBarClass(conf: string): string {
  switch (conf) {
    case "high":
      return "bg-emerald-400";
    case "medium":
      return "bg-amber-400";
    default:
      return "bg-white/40";
  }
}

type SuggestedProps = {
  suggestion: CanonicalStravaSuggestion;
  pending: boolean;
  onConfirm: (fd: FormData, stravaActivityId: string) => void;
  onNotRace: (stravaActivityId: string) => void;
};

export function SuggestedRaceCard({ suggestion: s, pending, onConfirm, onNotRace }: SuggestedProps) {
  const top = s.topMatch!;
  const stat = formatActivityStatLine({ date: s.startDateYmd, km: s.distanceKm, el: s.elevationM });
  const { stravaUrl, portfolioPath } = activityLinks(s.stravaActivityId);
  const conf = top.confidence;
  const scorePct = Math.min(100, Math.max(0, top.score));

  return (
    <Card className="w-full overflow-hidden border border-white/12 bg-panel/40 p-0">
      <div className="border-b border-white/10 px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Review</p>
        <p className="mt-2 text-lg font-medium leading-snug text-white">{top.name}</p>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-white/45">Match confidence</p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className={cn("h-full rounded-full transition-all", confidenceBarClass(conf))}
              style={{ width: `${scorePct}%` }}
            />
          </div>
          <span className="shrink-0 text-[11px] font-semibold capitalize text-white/70">{conf}</span>
        </div>
        <p className="mt-3 text-sm text-white/55">{stat}</p>
        <p className="mt-1 text-xs text-white/40">{s.activityTitle}</p>
      </div>
      <div className="flex flex-col gap-3 px-4 py-4">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm(new FormData(e.currentTarget), s.stravaActivityId);
          }}
        >
          <input type="hidden" name="canonical_race_id" value={top.canonicalRaceId} />
          <input type="hidden" name="strava_activity_id" value={s.stravaActivityId} />
          <input type="hidden" name="date" value={s.startDateYmd} />
          <input type="hidden" name="distance_km" value={String(s.distanceKm)} />
          <input type="hidden" name="elevation_m" value={s.elevationM != null ? String(s.elevationM) : ""} />
          <Button type="submit" disabled={pending} className="min-h-[48px] w-full text-[13px] font-semibold uppercase tracking-[0.1em]">
            {pending ? "Saving…" : "Confirm race"}
          </Button>
        </form>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          className="min-h-[48px] w-full border-white/20 bg-white/[0.06] text-[13px] font-semibold uppercase tracking-[0.1em] text-white/90"
          onClick={() => onNotRace(s.stravaActivityId)}
        >
          Not a race
        </Button>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-white/40">
          {stravaUrl ? (
            <a href={stravaUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:text-white hover:underline">
              Strava
            </a>
          ) : (
            <Link href={portfolioPath} className="underline-offset-2 hover:text-white hover:underline">
              Activity
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}

