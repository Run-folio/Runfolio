"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { backfillStravaHistoryAction } from "@/lib/actions";
import type { StravaBackfillProgress, StravaBackfillUxPhase } from "@/lib/strava-backfill-model";
import { usePersistence } from "@/components/persistence-context";
import { buildSetupUrl } from "@/lib/setup-url";
import {
  BACKFILL_DEFAULT_MAX_PAGES,
  BACKFILL_FIRST_BATCH_MAX_PAGES,
  PER_PAGE
} from "@/lib/strava-sync/fetch-summaries";
import { HISTORICAL_BACKFILL_MIN_HIGH_SIGNAL_KM } from "@/lib/strava-sync/import-scope";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PHASE_UI: Record<
  StravaBackfillUxPhase,
  { title: string; description: string; badgeClass: string }
> = {
  ready: {
    title: "Ready to import",
    description:
      "We’ll pull likely race efforts from Strava in small batches and save them in Runfolio. You can pause anytime—progress is remembered.",
    badgeClass: "border-sky-400/40 bg-sky-500/10 text-sky-100"
  },
  partial: {
    title: "Partially imported",
    description:
      "Some history is already saved. Keep going to walk further back in time, or jump to Match & Import to review what you have.",
    badgeClass: "border-amber-400/35 bg-amber-500/12 text-amber-50"
  },
  complete: {
    title: "Import complete",
    description:
      "We reached the oldest activities Strava returned for your account. Future checks use **Sync new activities** only—it won’t rescan your full history.",
    badgeClass: "border-emerald-400/35 bg-emerald-500/10 text-emerald-50"
  },
  no_matches: {
    title: "No likely race efforts found (in scanned history)",
    description:
      "That’s expected for some accounts: we only auto-save **high-signal** efforts in backfill (see below). Nothing is wrong with your Strava—use **Find a race** or **Add race** to link a specific finish, or run another batch if you haven’t reached older years yet.",
    badgeClass: "border-white/15 bg-white/5 text-white/75"
  },
  rate_limited: {
    title: "Paused — Strava rate limit",
    description:
      "Strava temporarily limited requests. Progress from the last successful batch stays saved—wait before running another import or sync. If we showed a wait time below, prefer that over a fixed guess.",
    badgeClass: "border-rose-400/35 bg-rose-500/12 text-rose-50"
  },
  needs_attention: {
    title: "Last import didn’t finish",
    description:
      "Something went wrong on the last batch. Review the message below and try again when ready.",
    badgeClass: "border-orange-400/40 bg-orange-500/12 text-orange-50"
  }
};

type BackfillBatchSummary = {
  upserted: number;
  skippedUnchanged: number;
  eligibleInBatch: number;
  rawFetched: number;
  backfillExhausted: boolean;
  /** True when Strava returned rows but none passed the historical import filter */
  batchHadStravaRowsButNoneEligible: boolean;
};

function formatWhen(iso: string | null): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

type Props = {
  initialProgress: StravaBackfillProgress;
  stravaOAuthConfigured: boolean;
};

export function StravaBackfillExperience({ initialProgress, stravaOAuthConfigured }: Props) {
  const router = useRouter();
  const { persistenceAvailable, reason } = usePersistence();
  const [pending, start] = useTransition();
  const [banner, setBanner] = useState<string | null>(null);
  const [lastBatchSummary, setLastBatchSummary] = useState<BackfillBatchSummary | null>(null);
  const phaseInfo = useMemo(() => {
    if (!initialProgress.ingestStateTableAvailable) {
      return {
        title: "Database setup required",
        description:
          initialProgress.lastError ??
          "Apply supabase/migration_strava_ingest_state.sql (see MIGRATION_ORDER.txt) so backfill and incremental cursors can be stored.",
        badgeClass: "border-amber-400/40 bg-amber-500/12 text-amber-50"
      };
    }
    return PHASE_UI[initialProgress.phase];
  }, [initialProgress]);

  const lastRun = formatWhen(initialProgress.lastBackfillAt);

  const canRunBackfill =
    initialProgress.ingestStateTableAvailable &&
    stravaOAuthConfigured &&
    persistenceAvailable &&
    !pending &&
    initialProgress.phase !== "complete" &&
    initialProgress.phase !== "no_matches" &&
    initialProgress.phase !== "rate_limited";

  const runImport = () => {
    setBanner(null);
    start(async () => {
      const res = await backfillStravaHistoryAction();
      if ("error" in res && res.error) {
        setLastBatchSummary(null);
        setBanner(res.error);
        return;
      }
      if ("ok" in res && res.ok) {
        const batchHadStravaRowsButNoneEligible =
          res.rawFetched > 0 && res.eligibleInBatch === 0 && res.upserted === 0 && res.skippedUnchanged === 0;
        setLastBatchSummary({
          upserted: res.upserted,
          skippedUnchanged: res.skippedUnchanged,
          eligibleInBatch: res.eligibleInBatch,
          rawFetched: res.rawFetched,
          backfillExhausted: res.backfillExhausted,
          batchHadStravaRowsButNoneEligible
        });
        setBanner(
          res.stoppedForRateLimit && res.rateLimitUserMessage?.trim()
            ? res.rateLimitUserMessage
            : null
        );
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="type-eyebrow text-accent">Strava · Race history</p>
        <h1 className="font-display text-4xl font-normal tracking-tight text-white md:text-5xl">
          Import past race efforts
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-white/70">
          Import likely race efforts from your Strava history. We&apos;ll save them in Runfolio for matching and review at
          full quality—no need to keep calling Strava for what&apos;s already imported. Ongoing{" "}
          <strong className="font-medium text-white/85">sync</strong> only checks for{" "}
          <strong className="font-medium text-white/85">new</strong> activities after your last successful sync.
        </p>
      </header>

      <section
        className="rounded-[14px] border border-sky-400/25 bg-sky-500/[0.07] p-5 md:p-6"
        aria-labelledby="backfill-expectations-heading"
      >
        <h2 id="backfill-expectations-heading" className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200/90">
          What to expect
        </h2>
        <ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-relaxed text-white/75 marker:text-sky-300">
          <li>
            Backfill is intentionally selective: we import <strong className="text-white/90">likely races first</strong>{" "}
            (long runs and clear signals)—not every run in your Strava history.
          </li>
          <li>
            Shorter or low-key efforts may <strong className="text-white/90">not</strong> appear automatically. That keeps
            rate limits and matching noise under control.
          </li>
          <li>
            You can still <strong className="text-white/90">link any saved activity</strong> from a{" "}
            <Link href="/races/find" className="font-semibold text-accent underline-offset-4 hover:underline">
              verified race page
            </Link>{" "}
            (broader distance rules than backfill) or use{" "}
            <Link href="/races/new" className="font-semibold text-accent underline-offset-4 hover:underline">
              Add race
            </Link>{" "}
            with a Strava URL. <strong className="text-white/90">Sync new activities</strong> also uses a wider import bar
            for fresh efforts.
          </li>
        </ul>
      </section>

      {!stravaOAuthConfigured ? (
        <div className="rounded-[14px] border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-50/95">
          Strava isn&apos;t configured on this server. Add{" "}
          <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">STRAVA_CLIENT_ID</code> /{" "}
          <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">STRAVA_CLIENT_SECRET</code> to enable import.
        </div>
      ) : null}

      {!persistenceAvailable && reason ? (
        <p className="text-sm text-amber-200/90">
          {reason}{" "}
          <Link href={buildSetupUrl("/import/past-races")} className="font-semibold text-accent underline-offset-4 hover:underline">
            Open setup
          </Link>
        </p>
      ) : null}

      <section
        className="rounded-[14px] border border-white/10 bg-panel/35 p-6 md:p-8"
        aria-labelledby="backfill-status-heading"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h2 id="backfill-status-heading" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Status
            </h2>
            <p
              className={cn(
                "inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider",
                phaseInfo.badgeClass
              )}
            >
              {phaseInfo.title}
            </p>
            <p className="max-w-xl text-sm leading-relaxed text-white/70">
              {phaseInfo.description.split("**").map((chunk, i) =>
                i % 2 === 1 ? (
                  <strong key={i} className="font-medium text-white/85">
                    {chunk}
                  </strong>
                ) : (
                  <span key={i}>{chunk}</span>
                )
              )}
            </p>
            <p className="max-w-xl text-[11px] leading-relaxed text-muted">
              Progress uses your saved import batches and activity counts in Runfolio. We don&apos;t show a &quot;percent of
              Strava history&quot;—Strava doesn&apos;t give a reliable total.
            </p>
            <dl className="mt-4 grid gap-2 text-[13px] text-white/60 sm:grid-cols-2">
              <div>
                <dt className="text-muted">Activities saved in Runfolio</dt>
                <dd className="font-medium text-white/85">{initialProgress.syncedActivityCount}</dd>
              </div>
              <div>
                <dt className="text-muted">History batches completed</dt>
                <dd className="font-medium text-white/85">{initialProgress.backfillBatchesCompleted}</dd>
              </div>
              <div>
                <dt className="text-muted">More Strava history available</dt>
                <dd className="font-medium text-white/85">{initialProgress.moreHistoryAvailable ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-muted">Last batch</dt>
                <dd className="font-medium text-white/85">{lastRun ?? "—"}</dd>
              </div>
            </dl>
            {initialProgress.phase === "rate_limited" && initialProgress.lastError ? (
              <p className="mt-3 rounded-lg border border-rose-400/25 bg-rose-950/35 px-3 py-2 text-sm text-rose-100/90">
                {initialProgress.lastError}
              </p>
            ) : null}
            {initialProgress.phase === "needs_attention" && initialProgress.lastError ? (
              <p className="mt-3 rounded-lg border border-orange-400/30 bg-orange-950/40 px-3 py-2 text-sm text-orange-100/90">
                {initialProgress.lastError}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="primary"
            className="min-h-[48px] px-8 text-[12px] font-semibold uppercase tracking-[0.12em]"
            disabled={!canRunBackfill}
            title={
              !initialProgress.ingestStateTableAvailable
                ? "Fix database setup before importing."
                : initialProgress.phase === "complete" || initialProgress.phase === "no_matches"
                  ? "Historical import is finished for this path."
                  : initialProgress.phase === "rate_limited"
                    ? "Wait before retrying — Strava rate limits are temporary."
                    : undefined
            }
            onClick={runImport}
          >
            {pending
              ? "Importing…"
              : initialProgress.phase === "ready"
                ? "Start import — first batch"
                : "Import next batch"}
          </Button>
          <Link
            href="/matches"
            className={cn(
              "inline-flex min-h-[48px] items-center justify-center rounded-[12px] border border-border bg-panelAlt px-8 text-[12px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-slate-800"
            )}
          >
            Open Match &amp; import
          </Link>
        </div>

        {lastBatchSummary ? (
          <div
            className="mt-8 rounded-[12px] border border-white/12 bg-black/25 p-5"
            role="status"
            aria-label="Last backfill batch summary"
          >
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Last batch summary</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-white/80">
              <li>
                <strong className="font-medium text-white/90">Saved or updated:</strong> {lastBatchSummary.upserted} (new
                rows written or changed in Runfolio)
              </li>
              <li>
                <strong className="font-medium text-white/90">Already up to date:</strong> {lastBatchSummary.skippedUnchanged}
              </li>
              <li>
                <strong className="font-medium text-white/90">Matched our historical rules:</strong>{" "}
                {lastBatchSummary.eligibleInBatch} of {lastBatchSummary.rawFetched} Strava activities in this batch
              </li>
            </ul>
            <p className="mt-4 text-[13px] leading-relaxed text-white/65">
              <strong className="text-white/85">How selection works:</strong> Run / Trail Run / TrailRun / Race (and the
              same distance rules for VirtualRun) are considered. By default we keep activities from{" "}
              <strong className="text-white/85">{HISTORICAL_BACKFILL_MIN_HIGH_SIGNAL_KM} km</strong> and up. Shorter
              efforts only join when they have strong <strong className="text-white/85">race-like titles</strong> (with a
              minimum distance to cut noise) or line up with our <strong className="text-white/85">verified race catalog</strong>{" "}
              (fast name + distance + location-style signals)—same idea as Match & Import, not a guess at your whole
              archive.
            </p>
            {lastBatchSummary.batchHadStravaRowsButNoneEligible ? (
              <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] leading-relaxed text-white/70">
                This batch pulled Strava rows, but <strong className="text-white/85">none met the historical bar</strong>.
                That is normal for older training blocks—continue with the next batch or use{" "}
                <Link href="/races/find" className="font-semibold text-accent underline-offset-4 hover:underline">
                  Find a race
                </Link>{" "}
                /{" "}
                <Link href="/races/new" className="font-semibold text-accent underline-offset-4 hover:underline">
                  Add race
                </Link>{" "}
                for a specific finish.
              </p>
            ) : null}
            {lastBatchSummary.backfillExhausted ? (
              <p className="mt-3 text-[13px] text-white/65">
                You&apos;ve reached the end of the Strava list we&apos;re walking backward through for this path.
              </p>
            ) : null}
          </div>
        ) : null}

        {banner ? (
          <p className="mt-6 text-sm text-amber-100/90" role="alert">
            {banner}
          </p>
        ) : null}
      </section>

      <section className="max-w-2xl space-y-3 text-sm leading-relaxed text-white/65">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">What we import (historical backfill)</h2>
        <ul className="list-inside list-disc space-y-1.5 marker:text-accent">
          <li>
            Types: Run, Trail Run / TrailRun, Race, and VirtualRun under the same distance / title / catalog rules.
          </li>
          <li>
            Default distance bar:{" "}
            <strong className="font-medium text-white/80">{HISTORICAL_BACKFILL_MIN_HIGH_SIGNAL_KM} km+</strong>. Incremental
            &quot;Sync new&quot; uses a <strong className="font-medium text-white/80">30 km</strong> bar plus a manual pool
            for shorter new activities.
          </li>
          <li>
            Under {HISTORICAL_BACKFILL_MIN_HIGH_SIGNAL_KM} km we only add rows when titles look like structured events
            (15km+ floor) or when a strong <strong className="font-medium text-white/80">catalog match</strong> supports
            the effort (10km+ floor).
          </li>
          <li>
            The <strong className="font-medium text-white/80">first</strong> import batch loads at most{" "}
            {BACKFILL_FIRST_BATCH_MAX_PAGES} Strava list page (~{PER_PAGE * BACKFILL_FIRST_BATCH_MAX_PAGES} activities) to
            stay gentle on rate limits; later batches load up to {BACKFILL_DEFAULT_MAX_PAGES} pages (~
            {PER_PAGE * BACKFILL_DEFAULT_MAX_PAGES} activities) each.
          </li>
          <li>Rows are deduped locally—re-running won&apos;t create duplicates.</li>
        </ul>
      </section>

      <section className="max-w-2xl rounded-[14px] border border-white/10 bg-panel/25 p-5 md:p-6">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Looking for one specific race?</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          Open a race in{" "}
          <Link href="/races/find" className="font-semibold text-accent underline-offset-4 hover:underline">
            Find a race
          </Link>{" "}
          and use <strong className="text-white/85">Link to Strava activity</strong>. That picker uses{" "}
          <strong className="text-white/85">saved</strong> activities in Runfolio with a{" "}
          <strong className="text-white/85">per-race distance window</strong>—broader than the{" "}
          {HISTORICAL_BACKFILL_MIN_HIGH_SIGNAL_KM} km backfill default—so half marathons and similar finishes can appear
          when they&apos;re synced. If an effort was never imported, use{" "}
          <Link href="/races/new" className="font-semibold text-accent underline-offset-4 hover:underline">
            Add race
          </Link>{" "}
          with the Strava activity link.
        </p>
      </section>

      <p className="text-center text-[11px] text-muted">
        <Link href="/dashboard" className="font-semibold text-accent underline-offset-4 hover:underline">
          ← Back to overview
        </Link>
      </p>
    </div>
  );
}
