"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { ProfileStravaMediumMatch } from "@/types";
import { confirmKnownRaceMatchAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";

type Props = {
  matches: ProfileStravaMediumMatch[];
  /** e.g. `/alice` — safe relative path only */
  profilePath: string;
};

function buildFormData(m: ProfileStravaMediumMatch, profilePath: string, completeBucket: boolean): FormData {
  const fd = new FormData();
  fd.set("discover_race_id", m.discoverRaceId);
  fd.set("strava_activity_id", m.stravaId);
  if (completeBucket && m.userRaceId) fd.set("target_user_race_id", m.userRaceId);
  fd.set("date", m.date);
  fd.set("distance_km", String(m.distanceKm));
  fd.set("elevation_m", m.elevationM != null ? String(Math.round(m.elevationM)) : "");
  fd.set("time", m.movingTimeLabel);
  fd.set("location", m.location);
  fd.set("description", "");
  fd.set("return_to", profilePath);
  return fd;
}

export function ProfileMediumMatchStrip({ matches: initialMatches, profilePath }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const matches = initialMatches.filter((m) => !dismissed.has(m.stravaId));

  if (matches.length === 0) return null;

  const runConfirm = (m: ProfileStravaMediumMatch, completeBucket: boolean) => {
    setError(null);
    startTransition(async () => {
      const res = await confirmKnownRaceMatchAction(buildFormData(m, profilePath, completeBucket));
      if (res && typeof res === "object" && "error" in res && res.error) setError(res.error);
    });
  };

  return (
    <section className="border-x border-b border-amber-500/35 bg-gradient-to-b from-amber-950/30 to-[#080a0e] px-5 py-6 md:px-8">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200/90">Needs your confirmation</p>
      <h2 className="type-section mt-2 text-base text-white md:text-lg">Possible major races from Strava</h2>
      <p className="type-meta mt-2 max-w-2xl text-sm">
        Medium-confidence matches stay suggestions until you confirm. Nothing is written to your bucket list or portfolio automatically — use the buttons below or confirm on{" "}
        <Link href="/races/new" className="text-teal underline-offset-4 hover:text-teal-hover hover:underline">
          Add race
        </Link>
        .
      </p>
      {error ? (
        <p className="mt-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="mt-5 space-y-4">
        {matches.map((m) => (
          <li
            key={m.stravaId}
            className="border border-white/10 bg-black/35 p-4 md:flex md:flex-wrap md:items-center md:justify-between md:gap-4"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white">
                We think <span className="text-accent">{m.displayTitle}</span>
              </p>
              <p className="type-meta mt-1 text-xs">
                Strava: {m.activityTitle} · {m.date} · {m.distanceKm} km
              </p>
              {m.reasons.length > 0 ? (
                <ul className="mt-2 list-inside list-disc text-[11px] text-muted">
                  {m.reasons.slice(0, 4).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : null}
              {m.onUserBucketList ? (
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-gold">On your bucket list</p>
              ) : null}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap md:mt-0">
              {m.onUserBucketList && m.userRaceId ? (
                <Button
                  type="button"
                  disabled={pending}
                  className="bg-green-800 hover:bg-green-700"
                  onClick={() => runConfirm(m, true)}
                >
                  Confirm — complete bucket
                </Button>
              ) : null}
              <Button type="button" disabled={pending} onClick={() => runConfirm(m, false)}>
                Confirm match
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => setDismissed((prev) => new Set(prev).add(m.stravaId))}
              >
                Not this race
              </Button>
              <Link
                href="/races/new"
                className="inline-flex items-center justify-center rounded-[12px] px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted transition hover:text-white"
              >
                Choose another…
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
