"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { backfillStravaHistoryAction } from "@/lib/actions";
import type {
  StravaBackfillProgress,
  StravaBackfillUxPhase,
  StravaRateLimitUxKind
} from "@/lib/strava-backfill-model";
import { hasServerRecordedStravaBackfillBatch } from "@/lib/strava-backfill-model";
import { usePersistence } from "@/components/persistence-context";
import { buildSetupUrl } from "@/lib/setup-url";
import {
  STRAVA_BACKFILL_JUMP_OPTIONS,
  type StravaBackfillJumpPreset
} from "@/lib/strava-sync/backfill-jump-windows";
import {
  BACKFILL_DATE_CHUNK_DAYS,
  BACKFILL_DEFAULT_MAX_PAGES,
  BACKFILL_FIRST_BATCH_MAX_PAGES,
  PER_PAGE
} from "@/lib/strava-sync/fetch-summaries";
import { HISTORICAL_BACKFILL_MIN_HIGH_SIGNAL_KM } from "@/lib/strava-sync/import-scope";
import type { StravaPersistFailure } from "@/lib/strava-sync/persist-failure";
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
      "Some history is already saved. Keep going to walk further back in time, or open My Races to review what you have.",
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

function rateLimitedPhaseUI(kind: StravaRateLimitUxKind | null): (typeof PHASE_UI)["rate_limited"] {
  if (kind === "daily") {
    return {
      title: "Paused — Strava daily limit",
      description:
        "Strava daily limit reached — try again after midnight UTC. Waiting 15 minutes will not help; this is Strava’s daily cap, not the short rolling window.",
      badgeClass: "border-rose-400/35 bg-rose-500/12 text-rose-50"
    };
  }
  if (kind === "short_window") {
    return {
      title: "Paused — Strava short-window limit",
      description:
        "Strava short-window limit reached — try again at the next 15-minute window once your read quota rolls forward.",
      badgeClass: "border-rose-400/35 bg-rose-500/12 text-rose-50"
    };
  }
  return {
    title: "Paused — Strava rate limit",
    description: "Strava rate limited — retry later.",
    badgeClass: "border-rose-400/35 bg-rose-500/12 text-rose-50"
  };
}

type BackfillBatchSummary = {
  upserted: number;
  skippedUnchanged: number;
  errors: number;
  skippedInvalid: number;
  writeAttempts: number;
  persistFailures: StravaPersistFailure[];
  eligibleInBatch: number;
  rawFetched: number;
  backfillExhausted: boolean;
  /** True when Strava returned rows but none passed the historical import filter */
  batchHadStravaRowsButNoneEligible: boolean;
  /** One-shot window scan — sequential cursor unchanged */
  jumpScan?: boolean;
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
  /** My Races: strip long copy; action-first import strip. */
  compact?: boolean;
};

export function StravaBackfillExperience({ initialProgress, stravaOAuthConfigured, compact = false }: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? "/my-races";
  const { persistenceAvailable, reason } = usePersistence();
  const [pending, start] = useTransition();
  const [banner, setBanner] = useState<string | null>(null);
  const [showBackfillReconnect, setShowBackfillReconnect] = useState(false);
  const [lastBatchSummary, setLastBatchSummary] = useState<BackfillBatchSummary | null>(null);
  /** Batch “completed” = Strava pages were fetched and evaluated, even when 0 activities were saved. */
  const hasStartedBackfill = useMemo(
    () =>
      hasServerRecordedStravaBackfillBatch(initialProgress) || lastBatchSummary != null,
    [initialProgress, lastBatchSummary]
  );

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
    if (initialProgress.phase === "rate_limited") {
      return rateLimitedPhaseUI(initialProgress.stravaRateLimitKind);
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

  /** Date-window jump works even when sequential backfill is finished (does not move the main cursor). */
  const canRunJumpScan =
    initialProgress.ingestStateTableAvailable &&
    stravaOAuthConfigured &&
    persistenceAvailable &&
    !pending &&
    initialProgress.phase !== "rate_limited";

  const runImport = () => {
    if (pending) return;
    setBanner(null);
    setShowBackfillReconnect(false);
    start(async () => {
      const res = await backfillStravaHistoryAction();
      if ("error" in res && res.error) {
        setLastBatchSummary(null);
        setShowBackfillReconnect("needStravaReconnect" in res && res.needStravaReconnect === true);
        setBanner(res.error);
        return;
      }
      if ("ok" in res && res.ok) {
        const batchHadStravaRowsButNoneEligible =
          res.rawFetched > 0 && res.eligibleInBatch === 0 && res.upserted === 0 && res.skippedUnchanged === 0;
        setLastBatchSummary({
          upserted: res.upserted,
          skippedUnchanged: res.skippedUnchanged,
          errors: res.errors,
          skippedInvalid: res.skippedInvalid,
          writeAttempts: res.writeAttempts,
          persistFailures: res.persistFailures ?? [],
          eligibleInBatch: res.eligibleInBatch,
          rawFetched: res.rawFetched,
          backfillExhausted: res.backfillExhausted,
          batchHadStravaRowsButNoneEligible,
          jumpScan: res.jumpScan === true
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

  const runJumpScan = (preset: StravaBackfillJumpPreset) => {
    if (pending) return;
    setBanner(null);
    setShowBackfillReconnect(false);
    start(async () => {
      const fd = new FormData();
      fd.set("jump_preset", preset);
      const res = await backfillStravaHistoryAction(fd);
      if ("error" in res && res.error) {
        setLastBatchSummary(null);
        setShowBackfillReconnect("needStravaReconnect" in res && res.needStravaReconnect === true);
        setBanner(res.error);
        return;
      }
      if ("ok" in res && res.ok) {
        const batchHadStravaRowsButNoneEligible =
          res.rawFetched > 0 && res.eligibleInBatch === 0 && res.upserted === 0 && res.skippedUnchanged === 0;
        setLastBatchSummary({
          upserted: res.upserted,
          skippedUnchanged: res.skippedUnchanged,
          errors: res.errors,
          skippedInvalid: res.skippedInvalid,
          writeAttempts: res.writeAttempts,
          persistFailures: res.persistFailures ?? [],
          eligibleInBatch: res.eligibleInBatch,
          rawFetched: res.rawFetched,
          backfillExhausted: res.backfillExhausted,
          batchHadStravaRowsButNoneEligible,
          jumpScan: res.jumpScan === true
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
    <div className={cn("space-y-10", compact && "space-y-6")}>
      {compact ? (
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Import from Strava</h2>
      ) : (
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
      )}

      {!compact ? (
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
      ) : null}

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
          <Link href={buildSetupUrl("/my-races")} className="font-semibold text-accent underline-offset-4 hover:underline">
            Open setup
          </Link>
        </p>
      ) : null}

      <section
        className={cn("rounded-[14px] border border-white/10 bg-panel/35", compact ? "p-4" : "p-6 md:p-8")}
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
            {!compact ? (
              <>
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
              </>
            ) : null}
            <dl className={cn("mt-4 grid gap-2 text-[13px] text-white/60", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
              {initialProgress.phase === "rate_limited" && initialProgress.stravaRateLimitUntil ? (
                <div className="sm:col-span-2">
                  <dt className="text-muted">Suggested earliest retry</dt>
                  <dd className="font-medium text-white/85">
                    {formatWhen(initialProgress.stravaRateLimitUntil) ?? initialProgress.stravaRateLimitUntil}
                    {initialProgress.stravaRateLimitKind === "daily" ? (
                      <span className="ml-1 text-[11px] text-muted">(next UTC day rollover)</span>
                    ) : null}
                  </dd>
                </div>
              ) : null}
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

        <div className={cn("mt-8 flex gap-3", compact ? "flex-col" : "flex-wrap")}>
          <Button
            type="button"
            variant="primary"
            className={cn("min-h-[48px] text-[12px] font-semibold uppercase tracking-[0.12em]", compact ? "w-full px-6" : "px-8")}
            disabled={!canRunBackfill || pending}
            aria-busy={pending}
            title={
              !initialProgress.ingestStateTableAvailable
                ? "Fix database setup before importing."
                : initialProgress.phase === "complete" || initialProgress.phase === "no_matches"
                  ? "Historical import is finished for this path."
                  : initialProgress.phase === "rate_limited"
                    ? initialProgress.stravaRateLimitKind === "daily"
                      ? "Daily Strava cap — try again after midnight UTC (or after the suggested time). Waiting 15 minutes will not fix a daily limit."
                      : initialProgress.stravaRateLimitKind === "short_window"
                        ? "Short-window limit — try again after the next ~15-minute Strava bucket."
                        : "Wait before retrying — Strava rate limits are temporary."
                    : undefined
            }
            onClick={runImport}
          >
            {pending
              ? "Importing…"
              : hasStartedBackfill
                ? "Continue backfill"
                : "Start import — first batch"}
          </Button>
          {!compact ? (
            <Link
              href="/my-races#my-races-queue"
              className={cn(
                "inline-flex min-h-[48px] items-center justify-center rounded-[12px] border border-border bg-panelAlt px-8 text-[12px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-slate-800"
              )}
            >
              Open My Races queue
            </Link>
          ) : (
            <Link
              href="#my-races-queue"
              className="inline-flex min-h-[48px] w-full items-center justify-center rounded-[12px] border border-border bg-panelAlt px-6 text-[12px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-slate-800"
            >
              Review matches below
            </Link>
          )}
        </div>

        {compact ? (
          <details className="mt-6 rounded-[12px] border border-white/10 bg-black/20 p-4">
            <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Import a specific date range
            </summary>
            <div className="mt-4 flex flex-col gap-2">
              {STRAVA_BACKFILL_JUMP_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant="secondary"
                  className="min-h-[48px] w-full justify-center border-white/20 bg-white/[0.04] text-[11px] font-semibold uppercase tracking-[0.1em] text-white/90 hover:bg-white/[0.08]"
                  disabled={!canRunJumpScan || pending}
                  title={opt.hint}
                  onClick={() => runJumpScan(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </details>
        ) : (
          <div className="mt-6 rounded-[12px] border border-white/10 bg-black/20 p-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Jump to older history</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              Pull a <strong className="font-medium text-white/85">specific past window</strong> in one go (Strava{" "}
              <code className="rounded bg-black/35 px-1 text-[11px] text-white/80">after</code> /{" "}
              <code className="rounded bg-black/35 px-1 text-[11px] text-white/80">before</code>
              ). Does <strong className="font-medium text-white/85">not</strong> move your sequential backfill cursor—use{" "}
              <strong className="font-medium text-white/85">Continue backfill</strong> for ordered history. Dedupes by Strava
              activity id.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {STRAVA_BACKFILL_JUMP_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant="secondary"
                  className="min-h-[44px] justify-start border-white/20 bg-white/[0.04] px-4 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-white/90 hover:bg-white/[0.08]"
                  disabled={!canRunJumpScan || pending}
                  title={opt.hint}
                  onClick={() => runJumpScan(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {lastBatchSummary ? (
          <div
            className="mt-8 rounded-[12px] border border-white/12 bg-black/25 p-5"
            role="status"
            aria-label="Last backfill batch summary"
          >
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Last batch summary</h3>
            {lastBatchSummary.jumpScan ? (
              <p className="mt-2 text-[12px] leading-relaxed text-sky-200/90">
                One-time <strong className="font-medium text-sky-100">date-window</strong> scan — your sequential import
                cursor was not changed.
              </p>
            ) : null}
            <ul className="mt-3 space-y-1.5 text-sm text-white/80">
              <li>
                <strong className="font-medium text-white/90">Saved or updated:</strong> {lastBatchSummary.upserted} (new
                rows written or changed in Runfolio)
              </li>
              <li>
                <strong className="font-medium text-white/90">Already up to date:</strong> {lastBatchSummary.skippedUnchanged}
              </li>
              <li>
                <strong className="font-medium text-white/90">DB write attempts:</strong> {lastBatchSummary.writeAttempts}{" "}
                (after dedupe — excludes “already up to date”)
              </li>
              <li>
                <strong className="font-medium text-white/90">Failed writes:</strong> {lastBatchSummary.errors}
                {lastBatchSummary.skippedInvalid > 0 ? (
                  <>
                    {" "}
                    · skipped invalid payload: {lastBatchSummary.skippedInvalid}
                  </>
                ) : null}
              </li>
              <li>
                <strong className="font-medium text-white/90">Matched our historical rules:</strong>{" "}
                {lastBatchSummary.eligibleInBatch} of {lastBatchSummary.rawFetched} Strava activities in this batch
              </li>
            </ul>
            {lastBatchSummary.eligibleInBatch > 0 &&
            lastBatchSummary.upserted === 0 &&
            lastBatchSummary.skippedUnchanged === 0 &&
            lastBatchSummary.errors > 0 ? (
              <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-950/35 px-3 py-2 text-[13px] leading-relaxed text-rose-100/95">
                Activities passed the import filter but <strong className="font-medium text-white">no rows were saved</strong>
                . Exact database diagnostics from this run are listed below (also logged as{" "}
                <code className="rounded bg-black/30 px-1">stravaSync.persist</code>).
              </p>
            ) : null}
            {lastBatchSummary.persistFailures.length > 0 ? (
              <details className="mt-4 rounded-lg border border-amber-400/25 bg-amber-950/20 p-3 text-left">
                <summary className="cursor-pointer text-[12px] font-semibold text-amber-100/95">
                  Database write diagnostics ({lastBatchSummary.persistFailures.length} entr
                  {lastBatchSummary.persistFailures.length === 1 ? "y" : "ies"}, capped)
                </summary>
                <ul className="mt-3 space-y-3 text-[11px] leading-relaxed text-amber-50/90">
                  {lastBatchSummary.persistFailures.map((f, i) => (
                    <li key={`${f.kind}-${f.strava_activity_id ?? "batch"}-${i}`}>
                      <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border border-white/10 bg-black/40 p-2 font-mono text-[10px] text-amber-50/95">
                        {JSON.stringify(f, null, 2)}
                      </pre>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            {!compact ? (
              <p className="mt-4 text-[13px] leading-relaxed text-white/65">
                <strong className="text-white/85">How selection works:</strong> Run / Trail Run / TrailRun / Race (and the
                same distance rules for VirtualRun) are considered. By default we keep activities from{" "}
                <strong className="text-white/85">{HISTORICAL_BACKFILL_MIN_HIGH_SIGNAL_KM} km</strong> and up. Shorter
                efforts only join when they have strong <strong className="text-white/85">race-like titles</strong> (with a
                minimum distance to cut noise) or line up with our <strong className="text-white/85">verified race catalog</strong>{" "}
                (fast name + distance + location-style signals)—same idea as Match & Import, not a guess at your whole
                archive.
              </p>
            ) : null}
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
          <div className="mt-6 space-y-2 text-sm text-amber-100/90" role="alert">
            <p>{banner}</p>
            {showBackfillReconnect ? (
              <Link
                href={`/api/strava/oauth/start?mode=reconnect&next=${encodeURIComponent(pathname)}`}
                className="font-semibold text-accent underline-offset-4 hover:underline"
              >
                Reconnect Strava
              </Link>
            ) : null}
          </div>
        ) : null}
      </section>

      {!compact ? (
        <>
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
                stay gentle on rate limits. Later batches each target roughly{" "}
                <strong className="font-medium text-white/80">{BACKFILL_DATE_CHUNK_DAYS} days</strong> of older history (Strava{" "}
                <code className="rounded bg-black/30 px-1 text-[11px]">after</code> /{" "}
                <code className="rounded bg-black/30 px-1 text-[11px]">before</code>) and paginate up to{" "}
                {BACKFILL_DEFAULT_MAX_PAGES} pages (~{PER_PAGE * BACKFILL_DEFAULT_MAX_PAGES} activities) inside that window.
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
        </>
      ) : null}
    </div>
  );
}
