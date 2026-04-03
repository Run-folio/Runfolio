"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { addCatalogRaceToBucketListAction, deleteFutureBucketGoalAction } from "@/lib/actions";
import { portfolioRaceHref } from "@/lib/profile-portfolio";
import { StravaActivityMatchModal } from "@/components/strava-activity-match-modal";
import { usePersistence } from "@/components/persistence-context";
import { buildSetupUrl } from "@/lib/setup-url";
import type { DiscoverStravaActivityCandidate, Race } from "@/types";

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
  stravaFeedErrorMessage?: string;
  /** Activities returned from Strava list API (full feed length when sync succeeded). */
  stravaSyncedActivityCount: number;
  /** Run-like activities for this race’s distance window not already linked elsewhere. */
  stravaManualEligibleCount: number;
};

export function RaceDiscoverPortfolioActions({
  discoverRaceId,
  raceDisplayTitle,
  discoverLocation,
  isAuthed,
  completedRow,
  bucketFutureRow,
  stravaCandidates,
  stravaOk,
  stravaOAuthConfigured,
  stravaFeedErrorMessage,
  stravaSyncedActivityCount,
  stravaManualEligibleCount
}: Props) {
  const router = useRouter();
  const { persistenceAvailable, reason: persistenceReason } = usePersistence();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);

  const returnTo = `/races/${discoverRaceId}`;

  const runBucketAdd = useCallback(() => {
    if (!persistenceAvailable) {
      setMsg(persistenceReason ?? "Saving isn’t available.");
      return;
    }
    setMsg(null);
    const fd = new FormData();
    fd.set("discover_race_id", discoverRaceId);
    startTransition(async () => {
      const res = await addCatalogRaceToBucketListAction(fd);
      if ("error" in res && res.error) {
        setMsg(`Couldn’t save. ${res.error}`);
        return;
      }
      if ("already" in res && res.already) {
        setMsg("Already on your bucket list.");
      }
      router.refresh();
    });
  }, [discoverRaceId, persistenceAvailable, persistenceReason, router]);

  const runRemoveBucket = useCallback(() => {
    if (!bucketFutureRow) return;
    if (!persistenceAvailable) {
      setMsg(persistenceReason ?? "Saving isn’t available.");
      return;
    }
    setMsg(null);
    const fd = new FormData();
    fd.set("race_id", bucketFutureRow.id);
    startTransition(async () => {
      const res = await deleteFutureBucketGoalAction(fd);
      if ("error" in res && res.error) {
        setMsg(`Couldn’t save. ${res.error}`);
        return;
      }
      setLinkOpen(false);
      router.refresh();
    });
  }, [bucketFutureRow, persistenceAvailable, persistenceReason, router]);

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

      {!persistenceAvailable ? (
        <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
          {persistenceReason ?? "Database not connected — portfolio actions are disabled."}{" "}
          <Link href={buildSetupUrl(returnTo)} className="font-semibold text-amber-50 underline-offset-4 hover:underline">
            Continue setup
          </Link>
        </p>
      ) : null}

      {!bucketFutureRow ? (
        <button
          type="button"
          disabled={pending || !persistenceAvailable}
          title={!persistenceAvailable ? persistenceReason ?? undefined : undefined}
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
          disabled={!persistenceAvailable}
          title={!persistenceAvailable ? persistenceReason ?? undefined : undefined}
          onClick={() => {
            if (!persistenceAvailable) {
              setMsg(persistenceReason ?? "Saving isn’t available.");
              return;
            }
            setLinkOpen(true);
            setMsg(null);
          }}
          className="flex w-full items-center justify-center rounded-[12px] border border-white/18 px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-white transition hover:border-accent/40 hover:text-accent disabled:opacity-50"
        >
          Link to Strava activity
        </button>
        <p className="text-[11px] leading-relaxed text-muted">
          Uses activities <strong className="text-white/75">saved in Runfolio</strong>, with a distance window tuned to
          this race—<strong className="text-white/75">broader than automated backfill</strong> so half marathons and similar
          can show when they&apos;re synced. For a finish that was never imported, use manual add with the Strava URL.
        </p>
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
          disabled={pending || !persistenceAvailable}
          onClick={runRemoveBucket}
          className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted underline-offset-4 hover:text-white hover:underline disabled:opacity-50"
        >
          {pending ? "Saving…" : "Remove from bucket list"}
        </button>
      ) : null}

      <StravaActivityMatchModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        discoverRaceId={discoverRaceId}
        raceDisplayTitle={raceDisplayTitle}
        discoverLocation={discoverLocation}
        bucketFutureRaceId={bucketFutureRow?.id ?? null}
        returnTo={returnTo}
        stravaCandidates={stravaCandidates}
        stravaOk={stravaOk}
        stravaOAuthConfigured={stravaOAuthConfigured}
        stravaFeedErrorMessage={stravaFeedErrorMessage}
        stravaSyncedActivityCount={stravaSyncedActivityCount}
        stravaManualEligibleCount={stravaManualEligibleCount}
      />
    </div>
  );
}
