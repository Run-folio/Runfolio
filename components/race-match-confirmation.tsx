"use client";

import { useState, useTransition } from "react";
import type { RaceMatchCandidate } from "@/types";
import { confirmKnownRaceMatchAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type FormSnap = {
  date: string;
  distance_km: string;
  elevation_m: string;
  time: string;
  location: string;
  description: string;
};

type Props = {
  candidates: RaceMatchCandidate[];
  stravaActivityId: string;
  activityTitle: string;
  formSnap: FormSnap;
  onDismiss: () => void;
  /** Passed to the server action for `revalidatePath` after redirect. */
  returnTo?: string;
};

function confidenceLabel(c: RaceMatchCandidate["confidence"]): string {
  if (c === "high") return "High match";
  if (c === "medium") return "Needs review";
  return "Check details";
}

function buildFormData(
  c: RaceMatchCandidate,
  stravaActivityId: string,
  snap: FormSnap,
  options: { completeBucket: boolean; returnTo: string }
): FormData {
  const fd = new FormData();
  fd.set("discover_race_id", c.discoverRaceId);
  fd.set("strava_activity_id", stravaActivityId);
  if (options.completeBucket && c.userRaceId) {
    fd.set("target_user_race_id", c.userRaceId);
  }
  fd.set("date", snap.date);
  fd.set("distance_km", snap.distance_km);
  fd.set("elevation_m", snap.elevation_m);
  fd.set("time", snap.time);
  fd.set("location", snap.location);
  fd.set("description", snap.description);
  fd.set("return_to", options.returnTo);
  return fd;
}

export function RaceMatchConfirmation({
  candidates,
  stravaActivityId,
  activityTitle,
  formSnap,
  onDismiss,
  returnTo = "/races/new"
}: Props) {
  const [mode, setMode] = useState<"top" | "pick">("top");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const top = candidates[0];
  if (!top) return null;

  const runConfirm = (c: RaceMatchCandidate, completeBucket: boolean) => {
    setError(null);
    startTransition(async () => {
      const fd = buildFormData(c, stravaActivityId, formSnap, { completeBucket, returnTo });
      const res = await confirmKnownRaceMatchAction(fd);
      if (res && "error" in res && res.error) {
        setError(res.error);
      }
    });
  };

  const showHighCopy = top.confidence === "high";

  return (
    <Card className="border-accent/40 bg-gradient-to-b from-accent/10 via-[#0a0c12] to-[#070910] p-0 shadow-[0_0_0_1px_rgba(232,122,61,0.15)]">
      <div className="border-b border-white/10 px-5 py-4 md:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">Major race match</p>
        <h3 className="mt-2 font-display text-xl text-white md:text-2xl">
          {showHighCopy ? (
            <>
              We think this was <span className="text-accent">{top.title}</span>
            </>
          ) : (
            <>Possible major race matches</>
          )}
        </h3>
        <p className="type-meta mt-2 text-sm">
          Activity: <span className="text-white/90">{activityTitle}</span> — we won&apos;t link anything until you confirm.
        </p>
      </div>

      <div className="space-y-4 px-5 py-5 md:px-6">
        {error ? (
          <p className="rounded-md border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200" role="alert">
            {error}
          </p>
        ) : null}

        {mode === "top" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  top.confidence === "high"
                    ? "border-green-500/50 bg-green-500/10 text-green-300"
                    : top.confidence === "medium"
                      ? "border-amber-500/50 bg-amber-500/10 text-amber-100"
                      : "border-white/20 bg-white/5 text-muted"
                )}
              >
                {confidenceLabel(top.confidence)} · {Math.round(top.score * 100)}%
              </span>
              {top.onUserBucketList ? (
                <span className="border border-gold/50 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">
                  On your bucket list
                </span>
              ) : (
                <span className="border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Not on bucket list
                </span>
              )}
            </div>
            <p className="text-sm text-slate-300">
              <span className="font-semibold text-white">{top.title}</span>
              <span className="text-muted"> · </span>
              {top.location}
              <span className="text-muted"> · </span>~{top.distanceKm} km
            </p>
            {top.reasons.length > 0 ? (
              <ul className="list-inside list-disc space-y-1 text-xs text-muted">
                {top.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}

            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap">
              {top.onUserBucketList && top.userRaceId ? (
                <Button
                  type="button"
                  disabled={pending}
                  className="bg-green-700 hover:bg-green-600"
                  onClick={() => runConfirm(top, true)}
                >
                  {pending ? "Saving…" : "Confirm — mark bucket list complete"}
                </Button>
              ) : null}
              <Button type="button" disabled={pending} onClick={() => runConfirm(top, false)}>
                {pending ? "Saving…" : top.onUserBucketList ? "Add as new completed race" : "Confirm match"}
              </Button>
              <Button type="button" variant="secondary" disabled={pending} onClick={onDismiss}>
                Not this race
              </Button>
              {candidates.length > 1 ? (
                <Button type="button" variant="ghost" disabled={pending} onClick={() => setMode("pick")}>
                  Choose another…
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted">Pick the race that fits best:</p>
            <ul className="space-y-3">
              {candidates.slice(0, 6).map((c) => (
                <li
                  key={c.discoverRaceId}
                  className="flex flex-col gap-2 border border-border bg-black/30 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-white">{c.title}</p>
                    <p className="type-meta text-xs">
                      {c.location} · ~{c.distanceKm} km · {confidenceLabel(c.confidence)} ({Math.round(c.score * 100)}%)
                    </p>
                    {c.onUserBucketList ? (
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-gold">On bucket list</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {c.onUserBucketList && c.userRaceId ? (
                      <Button type="button" className="py-1.5 text-[11px]" disabled={pending} onClick={() => runConfirm(c, true)}>
                        Complete bucket
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      className="py-1.5 text-[11px]"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => runConfirm(c, false)}
                    >
                      This one
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setMode("top")}>
              ← Back
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
