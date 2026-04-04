"use client";

import Link from "next/link";
import type { CanonicalStravaSuggestion } from "@/lib/strava-canonical-match/suggestions";
import type { RecentlyConfirmedFinish } from "@/lib/match-hub/service";
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

type SuggestedProps = {
  suggestion: CanonicalStravaSuggestion;
  pending: boolean;
  onConfirm: (fd: FormData, stravaActivityId: string) => void;
  onChange: (stravaActivityId: string) => void;
};

export function SuggestedRaceCard({ suggestion: s, pending, onConfirm, onChange }: SuggestedProps) {
  const top = s.topMatch!;
  const stat = formatActivityStatLine({ date: s.startDateYmd, km: s.distanceKm, el: s.elevationM });
  const { stravaUrl, portfolioPath } = activityLinks(s.stravaActivityId);

  return (
    <Card className="w-full overflow-hidden border border-white/12 bg-panel/40 p-0">
      <div className="border-b border-white/10 px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Suggested</p>
        <p className="mt-2 font-semibold leading-snug text-white">{s.activityTitle}</p>
        <p className="mt-1 text-sm text-white/55">{stat}</p>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-white/45">Catalog match</p>
        <p className="mt-1 text-lg font-medium leading-snug text-white">{top.name}</p>
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
            {pending ? "Saving…" : "Confirm"}
          </Button>
        </form>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          className="min-h-[48px] w-full border-white/20 bg-white/[0.06] text-[13px] font-semibold uppercase tracking-[0.1em] text-white/90"
          onClick={() => onChange(s.stravaActivityId)}
        >
          Change
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

type MatchedProps = {
  finish: RecentlyConfirmedFinish;
  className?: string;
};

export function MatchedRaceCard({ finish, className }: MatchedProps) {
  const { stravaUrl, portfolioPath } = activityLinks(finish.stravaActivityId);
  const stat = [finish.date ?? "—"].filter(Boolean).join(" · ");

  return (
    <Card className={cn("w-full border border-emerald-500/20 bg-emerald-950/15 p-4", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200/80">Linked</p>
      <p className="mt-2 font-semibold text-white">{finish.name}</p>
      <p className="mt-1 text-sm text-white/55">{stat}</p>
      <p className="mt-3 text-sm font-medium text-emerald-100/95">{finish.displayRaceName}</p>
      <div className="mt-4">
        <Link
          href={portfolioPath}
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-white/[0.08] text-[13px] font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-white/[0.12]"
        >
          View / Edit
        </Link>
      </div>
      {stravaUrl ? (
        <a
          href={stravaUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block text-center text-[11px] text-white/45 underline-offset-2 hover:text-white/70 hover:underline"
        >
          Open on Strava
        </a>
      ) : null}
    </Card>
  );
}
