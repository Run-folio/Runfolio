"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  buildManualBucketCompleteFormData,
  buildStravaDiscoverConfirmFormData
} from "@/lib/build-strava-discover-confirm-form";
import { confirmKnownRaceMatchAction, completeBucketGoalWithStravaAction } from "@/lib/actions";
import { usePersistence } from "@/components/persistence-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DiscoverStravaActivityCandidate } from "@/types";
import { cn } from "@/lib/utils";

function confidenceBadge(c: DiscoverStravaActivityCandidate["confidence"]): string {
  if (c === "high") return "High match";
  if (c === "medium") return "Needs review";
  return "Check details";
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
  /** Connection stub message when Strava token missing (no list API on page load). */
  stravaFeedErrorMessage?: string;
  /** When set (e.g. race detail page), empty states distinguish “nothing from Strava” vs “synced but filtered”. */
  stravaSyncedActivityCount?: number;
  stravaManualEligibleCount?: number;
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
  stravaOAuthConfigured,
  stravaFeedErrorMessage,
  stravaSyncedActivityCount,
  stravaManualEligibleCount
}: Props) {
  const { persistenceAvailable, reason: persistenceReason } = usePersistence();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<DiscoverStravaActivityCandidate | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) {
      setSearch("");
      setConfirming(null);
      setError(null);
    }
  }, [open]);

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stravaCandidates;
    return stravaCandidates.filter((c) => c.name.toLowerCase().includes(q));
  }, [stravaCandidates, search]);

  if (!open) return null;

  const syncedCount = stravaSyncedActivityCount ?? 0;
  const showConnectStravaOnly = !stravaOk && syncedCount === 0;
  const showOfflineSyncedBanner = !stravaOk && syncedCount > 0;

  const runConfirm = (c: DiscoverStravaActivityCandidate) => {
    if (!persistenceAvailable) {
      setError(persistenceReason ?? "Saving isn’t available.");
      return;
    }
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
              This list comes from <strong className="text-white/80">activities already saved</strong> in Runfolio (not a
              live Strava pull). For this race we use a <strong className="text-white/80">broader distance window</strong>{" "}
              than historical backfill—you can link shorter finishes here when they&apos;re in your synced set. After you
              confirm, the finish is stored here permanently.
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

        {!persistenceAvailable ? (
          <p className="mt-4 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90" role="status">
            {persistenceReason ?? "Database not connected — you can’t save this link yet."}
          </p>
        ) : null}

        {!stravaOAuthConfigured ? (
          <p className="mt-6 text-sm text-muted">Strava connection is not configured for this environment.</p>
        ) : showOfflineSyncedBanner ? (
          <p className="mt-6 rounded-[12px] border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-100/90" role="status">
            Live Strava didn&apos;t load this visit
            {stravaFeedErrorMessage ? ` — ${stravaFeedErrorMessage}` : ""}. Showing{" "}
            {syncedCount} saved activit{syncedCount === 1 ? "y" : "ies"} from your last sync — pick below if one matches.
          </p>
        ) : null}

        {!stravaOAuthConfigured ? null : showConnectStravaOnly ? (
          <div className="mt-6 space-y-3 rounded-[12px] border border-white/10 bg-black/30 p-4">
            <p className="text-sm text-slate-300">
              {stravaFeedErrorMessage?.trim()
                ? stravaFeedErrorMessage
                : `Connect Strava to import activities and prove this finish for ${raceDisplayTitle}.`}
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
            {stravaSyncedActivityCount !== undefined && stravaSyncedActivityCount === 0 ? (
              <>
                <p className="text-sm text-slate-200">
                  No activities are saved in Runfolio yet, so there&apos;s nothing to pick from here.
                </p>
                <p className="text-[11px] leading-relaxed text-muted">
                  Run <strong className="text-white/75">Import past race efforts</strong> (or{" "}
                  <strong className="text-white/75">Sync new activities</strong>) first so efforts land in your account.
                  Historical backfill only keeps high-signal efforts by design. For one specific activity on Strava, use{" "}
                  <Link href="/races/new" className="text-accent underline-offset-4 hover:underline">Add race</Link> with
                  the activity URL.
                </p>
              </>
            ) : stravaSyncedActivityCount !== undefined &&
              stravaSyncedActivityCount > 0 &&
              stravaManualEligibleCount !== undefined &&
              stravaManualEligibleCount === 0 ? (
              <>
                <p className="text-sm text-slate-200">
                  Saved activities are here, but none fit this race&apos;s link window right now.
                </p>
                <p className="text-[11px] leading-relaxed text-muted">
                  That&apos;s not a failure—often the finish wasn&apos;t imported yet (e.g. strict historical backfill),
                  Strava typed it outside run-like sports, it&apos;s outside this event&apos;s distance range, or it&apos;s
                  already linked elsewhere. Try <strong className="text-white/75">Sync new</strong> / another import
                  batch, or use{" "}
                  <Link href="/races/new" className="text-accent underline-offset-4 hover:underline">Add race</Link> with
                  the Strava URL for a direct path.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-200">Nothing to show in the list yet.</p>
                <p className="text-[11px] leading-relaxed text-muted">
                  Filters or scoring for this catalog race may have left the list empty even though you have synced runs—that
                  can happen and isn&apos;t Strava &quot;broken.&quot; Use search when items appear, run another import if
                  the finish might be unsaved, or link with{" "}
                  <Link href="/races/new" className="text-accent underline-offset-4 hover:underline">Add race</Link>.
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            <label className="mt-6 block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted">
                Search by activity name
              </span>
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="e.g. London, marathon date…"
                autoComplete="off"
              />
            </label>
            {filteredCandidates.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400" role="status">
                No name matches in this list for “{search.trim()}”. Try another word, clear the search, or check you’re
                searching within activities we already loaded here—not every Strava activity on your account.
              </p>
            ) : (
          <ul className="mt-4 space-y-3">
            {filteredCandidates.map((c) => (
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
                        disabled={pending || !persistenceAvailable}
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
                    disabled={!persistenceAvailable}
                    title={!persistenceAvailable ? persistenceReason ?? undefined : undefined}
                    onClick={() => {
                      if (!persistenceAvailable) {
                        setError(persistenceReason ?? "Saving isn’t available.");
                        return;
                      }
                      setConfirming(c);
                    }}
                    className="mt-4 w-full rounded-[10px] border border-white/18 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-white transition hover:border-accent/40 hover:text-accent disabled:opacity-50"
                  >
                    Choose this activity
                  </button>
                )}
              </li>
            ))}
          </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
