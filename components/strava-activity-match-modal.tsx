"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  buildManualBucketCompleteFormData,
  buildStravaDiscoverConfirmFormData
} from "@/lib/build-strava-discover-confirm-form";
import { confirmKnownRaceMatchAction, completeBucketGoalWithStravaAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import type { DiscoverStravaActivityCandidate } from "@/types";
import { cn } from "@/lib/utils";

function confidenceBadge(c: DiscoverStravaActivityCandidate["confidence"]): string {
  if (c === "high") return "Strong match";
  if (c === "medium") return "Likely match";
  return "Possible match";
}

type Props = {
  open: boolean;
  onClose: () => void;
  /** When set, confirmation uses catalog match + optional bucket row merge. */
  discoverRaceId: string | null;
  raceDisplayTitle: string;
  discoverLocation: string;
  bucketFutureRaceId: string | null;
  returnTo: string;
  stravaCandidates: DiscoverStravaActivityCandidate[];
  stravaOk: boolean;
  stravaOAuthConfigured: boolean;
};

export function StravaActivityMatchModal({
  open,
  onClose,
  discoverRaceId,
  raceDisplayTitle,
  discoverLocation,
  bucketFutureRaceId,
  returnTo,
  stravaCandidates,
  stravaOk,
  stravaOAuthConfigured
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<DiscoverStravaActivityCandidate | null>(null);

  if (!open) return null;

  const runConfirm = (c: DiscoverStravaActivityCandidate) => {
    setError(null);
    startTransition(async () => {
      let res: { error?: string } | void;
      if (discoverRaceId) {
        const fd = buildStravaDiscoverConfirmFormData(
          discoverRaceId,
          c,
          bucketFutureRaceId,
          returnTo,
          discoverLocation
        );
        res = await confirmKnownRaceMatchAction(fd);
      } else {
        if (!bucketFutureRaceId) {
          setError("Missing bucket list row.");
          return;
        }
        const fd = buildManualBucketCompleteFormData(bucketFutureRaceId, c, returnTo, discoverLocation);
        res = await completeBucketGoalWithStravaAction(fd);
      }
      if (res && typeof res === "object" && "error" in res && res.error) {
        setError(String(res.error));
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 sm:items-center" role="dialog">
      <div className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-[16px] border border-white/12 bg-[#0a0a0c] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Link Strava finish</p>
            <h3 className="mt-2 font-display text-lg text-white">Choose your activity</h3>
            <p className="type-meta mt-1 text-sm text-slate-400">
              Candidates are ranked by match signals when this is a catalog race. Nothing is saved until you confirm.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              setConfirming(null);
              setError(null);
            }}
            className="shrink-0 rounded-lg border border-white/15 px-2 py-1 text-xs text-muted hover:text-white"
          >
            Close
          </button>
        </div>

        {error ? (
          <p className="mt-4 text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}

        {!stravaOAuthConfigured ? (
          <p className="mt-6 text-sm text-muted">Strava connection is not configured for this environment.</p>
        ) : !stravaOk ? (
          <div className="mt-6 space-y-3 rounded-[12px] border border-white/10 bg-black/30 p-4">
            <p className="text-sm text-slate-300">
              Connect Strava to import activities and prove this finish for{" "}
              <span className="text-white">{raceDisplayTitle}</span>.
            </p>
            <Link
              href="/api/strava/oauth/start"
              className="inline-flex items-center justify-center rounded-[12px] bg-accent px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-white"
            >
              Connect Strava
            </Link>
          </div>
        ) : stravaCandidates.length === 0 ? (
          <div className="mt-6 space-y-3 rounded-[12px] border border-white/10 bg-black/30 p-4">
            <p className="text-sm text-slate-300">
              No suitable imported activities yet. After your race appears in Strava, refresh this page — we surface long
              run and race-type efforts only.
            </p>
            <p className="text-[11px] text-muted">
              Tip: open <Link href="/races/new" className="text-accent underline-offset-4 hover:underline">Add race</Link>{" "}
              to import a single activity by URL anytime.
            </p>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {stravaCandidates.map((c) => (
              <li
                key={c.strava_id}
                className={cn(
                  "rounded-[12px] border p-4 transition",
                  confirming?.strava_id === c.strava_id
                    ? "border-accent/50 bg-accent/10"
                    : "border-white/10 bg-black/25 hover:border-white/20"
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                      c.confidence === "high"
                        ? "border-green-500/45 bg-green-500/10 text-green-200"
                        : c.confidence === "medium"
                          ? "border-amber-500/45 bg-amber-500/10 text-amber-100"
                          : "border-white/20 text-muted"
                    )}
                  >
                    {confidenceBadge(c.confidence)}
                  </span>
                  {c.score > 0 ? (
                    <span className="text-[10px] text-muted">Score {(c.score * 100).toFixed(0)}%</span>
                  ) : null}
                </div>
                <p className="mt-2 font-semibold text-white">{c.name}</p>
                <dl className="mt-2 grid gap-1 text-[11px] text-slate-400 sm:grid-cols-2">
                  <div>
                    <dt className="text-muted">Date</dt>
                    <dd className="text-white/90">{c.date}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Distance</dt>
                    <dd className="text-white/90">{c.distance_km} km</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Elevation</dt>
                    <dd className="text-white/90">{c.elevation_m != null ? `${c.elevation_m} m` : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Type</dt>
                    <dd className="text-white/90">{c.sport_type ?? c.type ?? "—"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted">Where</dt>
                    <dd className="text-white/90">{c.location_label}</dd>
                  </div>
                </dl>
                {c.reasons.length > 0 ? (
                  <ul className="mt-3 list-inside list-disc text-[11px] text-slate-400">
                    {c.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                ) : null}

                {confirming?.strava_id === c.strava_id ? (
                  <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                    <p className="text-sm text-slate-200">
                      We think this activity was <span className="font-semibold text-accent">{raceDisplayTitle}</span>.
                      Confirm to link Strava and mark this bucket goal complete.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        disabled={pending}
                        onClick={() => runConfirm(c)}
                        className="border-green-500/45 bg-green-500/15 text-green-200 hover:bg-green-500/25"
                      >
                        {pending ? "Saving…" : "Confirm match"}
                      </Button>
                      <Button type="button" variant="ghost" disabled={pending} onClick={() => setConfirming(null)}>
                        Not this race
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(c)}
                    className="mt-4 w-full rounded-[10px] border border-white/18 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-white transition hover:border-accent/40 hover:text-accent"
                  >
                    Choose this activity
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
