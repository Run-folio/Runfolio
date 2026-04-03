"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import {
  addCatalogRaceToBucketListAction,
  confirmKnownRaceMatchAction,
  deleteFutureBucketGoalAction
} from "@/lib/actions";
import { portfolioRaceHref } from "@/lib/profile-portfolio";
import type { DiscoverStravaActivityCandidate, Race } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  discoverRaceId: string;
  raceDisplayTitle: string;
  discoverLocation: string;
  isAuthed: boolean;
  completedRow: Race | null;
  bucketFutureRow: Race | null;
  stravaCandidates: DiscoverStravaActivityCandidate[];
  stravaOk: boolean;
  stravaOAuthConfigured: boolean;
};

function confidenceBadge(c: DiscoverStravaActivityCandidate["confidence"]): string {
  if (c === "high") return "Strong match";
  if (c === "medium") return "Likely match";
  return "Possible match";
}

function buildConfirmFormData(
  discoverRaceId: string,
  candidate: DiscoverStravaActivityCandidate,
  bucketFutureRaceId: string | null,
  returnTo: string,
  fallbackLocation: string
): FormData {
  const fd = new FormData();
  fd.set("discover_race_id", discoverRaceId);
  fd.set("strava_activity_id", candidate.strava_id);
  if (bucketFutureRaceId) fd.set("target_user_race_id", bucketFutureRaceId);
  fd.set("date", candidate.date);
  fd.set("distance_km", String(candidate.distance_km));
  fd.set("elevation_m", candidate.elevation_m != null ? String(candidate.elevation_m) : "");
  fd.set("time", candidate.moving_time_label);
  const loc = candidate.location_label.trim();
  fd.set("location", loc && loc !== "—" ? loc : fallbackLocation);
  fd.set("description", "");
  fd.set("return_to", returnTo);
  return fd;
}

export function RaceDiscoverPortfolioActions({
  discoverRaceId,
  raceDisplayTitle,
  discoverLocation,
  isAuthed,
  completedRow,
  bucketFutureRow,
  stravaCandidates,
  stravaOk,
  stravaOAuthConfigured
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [confirming, setConfirming] = useState<DiscoverStravaActivityCandidate | null>(null);

  const returnTo = `/races/${discoverRaceId}`;

  const runBucketAdd = useCallback(() => {
    setMsg(null);
    const fd = new FormData();
    fd.set("discover_race_id", discoverRaceId);
    startTransition(async () => {
      const res = await addCatalogRaceToBucketListAction(fd);
      if ("error" in res && res.error) {
        setMsg(res.error);
        return;
      }
      if ("already" in res && res.already) {
        setMsg("Already on your bucket list.");
      }
      router.refresh();
    });
  }, [discoverRaceId, router]);

  const runRemoveBucket = useCallback(() => {
    if (!bucketFutureRow) return;
    setMsg(null);
    const fd = new FormData();
    fd.set("race_id", bucketFutureRow.id);
    startTransition(async () => {
      const res = await deleteFutureBucketGoalAction(fd);
      if ("error" in res && res.error) {
        setMsg(res.error);
        return;
      }
      setLinkOpen(false);
      router.refresh();
    });
  }, [bucketFutureRow, router]);

  const runConfirmLink = useCallback(
    (c: DiscoverStravaActivityCandidate) => {
      setMsg(null);
      const bucketId = bucketFutureRow?.id ?? null;
      const fd = buildConfirmFormData(discoverRaceId, c, bucketId, returnTo, discoverLocation);
      startTransition(async () => {
        const res = await confirmKnownRaceMatchAction(fd);
        if (res && "error" in res && res.error) {
          setMsg(res.error);
        }
      });
    },
    [bucketFutureRow?.id, discoverLocation, discoverRaceId, returnTo]
  );

  if (!isAuthed) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-300">
          Sign in to add this race to your bucket list, link an imported Strava effort, and keep everything in sync with your
          profile.
        </p>
        <Link
          href={`/auth/login?next=${encodeURIComponent(returnTo)}`}
          className="flex w-full items-center justify-center rounded-[12px] bg-accent px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-[#f08a4d]"
        >
          Sign in to track
        </Link>
      </div>
    );
  }

  if (completedRow) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-300">
          You have a confirmed finish for this event. It appears in your portfolio, journey, and collections when
          applicable.
        </p>
        <Link
          href={portfolioRaceHref(completedRow)}
          className="flex w-full items-center justify-center rounded-[12px] border border-gold/40 bg-gold/10 px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-gold transition hover:bg-gold/15"
        >
          Open your finish
        </Link>
        {completedRow.strava_activity_id ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href={`/activities/${completedRow.strava_activity_id}`}
              className="flex flex-1 items-center justify-center rounded-[12px] border border-white/15 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:border-white/30"
            >
              View linked activity
            </Link>
            <a
              href={`https://www.strava.com/activities/${completedRow.strava_activity_id}`}
              target="_blank"
              rel="noreferrer"
              className="flex flex-1 items-center justify-center rounded-[12px] border border-white/10 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted transition hover:text-white"
            >
              Open on Strava
            </a>
          </div>
        ) : null}
        <Link
          href={`/races/new?discover=${encodeURIComponent(discoverRaceId)}`}
          className="flex w-full items-center justify-center rounded-[12px] border border-white/12 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted transition hover:border-white/25 hover:text-white"
        >
          Log another year / edit details
        </Link>
        <p className="text-[10px] text-muted">
          Undo finish, drop bucket badges, or delete the row in{" "}
          <span className="text-white/80">Portfolio actions</span> below.
        </p>
        {msg ? <p className="text-xs text-amber-200/90">{msg}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {msg ? <p className="text-xs text-amber-200/90">{msg}</p> : null}

      {!bucketFutureRow ? (
        <button
          type="button"
          disabled={pending}
          onClick={runBucketAdd}
          className="flex w-full items-center justify-center rounded-[12px] bg-accent px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-[#f08a4d] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Add to bucket list"}
        </button>
      ) : (
        <div className="rounded-[12px] border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-100/90">On your bucket list</p>
          <p className="mt-1 text-xs text-muted">Track this goal in your portfolio — link a Strava finish when you run it.</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            setLinkOpen(true);
            setConfirming(null);
            setMsg(null);
          }}
          className="flex w-full items-center justify-center rounded-[12px] border border-white/18 px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-white transition hover:border-accent/40 hover:text-accent"
        >
          Link to Strava activity
        </button>
        <Link
          href={`/races/new?discover=${encodeURIComponent(discoverRaceId)}`}
          className="flex w-full items-center justify-center rounded-[12px] border border-white/10 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted transition hover:border-white/20 hover:text-white"
        >
          Edit details / manual add →
        </Link>
      </div>

      {bucketFutureRow ? (
        <button
          type="button"
          disabled={pending}
          onClick={runRemoveBucket}
          className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted underline-offset-4 hover:text-white hover:underline disabled:opacity-50"
        >
          {pending ? "…" : "Remove from bucket list"}
        </button>
      ) : null}

      {linkOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" role="dialog">
          <div className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-[16px] border border-white/12 bg-[#0a0a0c] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Match Strava effort</p>
                <h3 className="mt-2 font-display text-lg text-white">Link an imported activity</h3>
                <p className="type-meta mt-1 text-sm text-slate-400">
                  Candidates are ranked by title, location, distance, date, and activity type. Nothing is saved until you
                  confirm.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLinkOpen(false);
                  setConfirming(null);
                }}
                className="shrink-0 rounded-lg border border-white/15 px-2 py-1 text-xs text-muted hover:text-white"
              >
                Close
              </button>
            </div>

            {!stravaOAuthConfigured ? (
              <p className="mt-6 text-sm text-muted">Strava connection is not configured for this environment.</p>
            ) : !stravaOk ? (
              <div className="mt-6 space-y-3 rounded-[12px] border border-white/10 bg-black/30 p-4">
                <p className="text-sm text-slate-300">
                  Connect Strava to see imported activities and link a finish to{" "}
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
                  No strong candidates in your recent imported Strava activities for this race. You can keep it on your bucket
                  list, try again after your next long run imports, or add the finish manually.
                </p>
                <p className="text-[11px] text-muted">
                  We only suggest runs about half-marathon distance or longer that look like race efforts.
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
                      <span className="text-[10px] text-muted">Score {(c.score * 100).toFixed(0)}%</span>
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
                          Confirm to save the match, mark the race complete
                          {bucketFutureRow ? ", and complete your bucket list goal" : ""}.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => runConfirmLink(c)}
                            className="rounded-[10px] border border-green-500/45 bg-green-500/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-green-200 transition hover:bg-green-500/25 disabled:opacity-50"
                          >
                            {pending ? "Saving…" : "Confirm match"}
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setConfirming(null)}
                            className="rounded-[10px] border border-white/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted hover:text-white"
                          >
                            Not this race
                          </button>
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
      ) : null}
    </div>
  );
}
