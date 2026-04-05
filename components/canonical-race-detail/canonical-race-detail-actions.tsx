"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addCanonicalRaceToBucketListAction,
  markCanonicalBucketGoalCompletedAction,
  removeCanonicalBucketGoalAction
} from "@/lib/actions";
import { usePersistence } from "@/components/persistence-context";
import { OVERVIEW_PATH } from "@/lib/app-paths";
import { buildSetupUrl } from "@/lib/setup-url";
import { portfolioRaceHref } from "@/lib/profile-portfolio";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Race } from "@/types";

type BucketGoal = { id: string; status: string; linked_strava_activity_id: string | null };

type Props = {
  canonicalRaceId: string;
  slug: string;
  authed: boolean;
  bucketGoal: BucketGoal | null;
  primaryFinish: Race | null;
};

const linkBtnClass = cn(
  "inline-flex items-center justify-center rounded-[12px] px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.08em] transition",
  "bg-accent text-white hover:bg-gold-hover"
);

export function CanonicalRaceDetailActions({ canonicalRaceId, slug, authed, bucketGoal, primaryFinish }: Props) {
  const router = useRouter();
  const { persistenceAvailable, reason: persistenceReason } = usePersistence();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const future =
    bucketGoal && ["saved", "planned"].includes(bucketGoal.status) && !primaryFinish;
  const doneBucket =
    bucketGoal &&
    ["completed_unlinked", "completed_linked", "featured_on_profile"].includes(bucketGoal.status);
  const completed = Boolean(doneBucket || primaryFinish);
  const stravaLinked =
    bucketGoal?.linked_strava_activity_id?.trim() || primaryFinish?.strava_activity_id?.trim();

  const runAdd = () => {
    if (!persistenceAvailable) {
      setMsg(persistenceReason ?? "Saving isn’t available.");
      return;
    }
    setMsg(null);
    start(async () => {
      const fd = new FormData();
      fd.set("canonical_race_id", canonicalRaceId);
      const r = await addCanonicalRaceToBucketListAction(fd);
      if ("error" in r && r.error) {
        setMsg(`Couldn’t save. ${r.error}`);
        return;
      }
      router.refresh();
    });
  };

  const runRemove = () => {
    if (!bucketGoal?.id) return;
    if (!persistenceAvailable) {
      setMsg(persistenceReason ?? "Saving isn’t available.");
      return;
    }
    setMsg(null);
    start(async () => {
      const fd = new FormData();
      fd.set("goal_id", bucketGoal.id);
      fd.set("race_page_path", `/races/${slug}`);
      const r = await removeCanonicalBucketGoalAction(fd);
      if ("error" in r && r.error) {
        setMsg(`Couldn’t save. ${r.error}`);
        return;
      }
      router.refresh();
    });
  };

  const runMarkComplete = () => {
    if (!bucketGoal?.id) return;
    if (!persistenceAvailable) {
      setMsg(persistenceReason ?? "Saving isn’t available.");
      return;
    }
    setMsg(null);
    start(async () => {
      const fd = new FormData();
      fd.set("goal_id", bucketGoal.id);
      const r = await markCanonicalBucketGoalCompletedAction(fd);
      if ("error" in r && r.error) {
        setMsg(`Couldn’t save. ${r.error}`);
        return;
      }
      router.refresh();
    });
  };

  if (!authed) {
    return (
      <div className="space-y-3">
        <Link
          href={`/auth/login?next=${encodeURIComponent(`/races/${slug}`)}`}
          className={linkBtnClass}
        >
          Sign in to save this goal
        </Link>
        <p className="text-[13px] text-white/45">Add verified races to your bucket list and link finishes later.</p>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="space-y-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/90">In your story</p>
        {primaryFinish ? (
          <Link
            href={portfolioRaceHref(primaryFinish)}
            className="inline-flex w-fit rounded-[12px] border border-emerald-500/40 bg-emerald-950/30 px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-emerald-100 transition hover:border-emerald-400/55 hover:bg-emerald-950/45"
          >
            View your race story →
          </Link>
        ) : (
          <p className="text-sm text-white/65">
            Finish saved on your bucket list{stravaLinked ? "" : " — link Strava anytime from Overview"}.
          </p>
        )}
        {!stravaLinked ? (
          <p className="text-sm text-white/55">
            <Link href={OVERVIEW_PATH} className="font-medium text-teal underline-offset-4 hover:text-teal-hover hover:underline">
              Open Overview
            </Link>{" "}
            to attach a Strava activity.
          </p>
        ) : (
          <a
            href={`https://www.strava.com/activities/${stravaLinked}`}
            className="inline-block text-[13px] font-semibold text-teal underline-offset-4 hover:text-teal-hover hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Open on Strava →
          </a>
        )}
        {msg ? (
          <p className="text-sm text-amber-200/90" role="status">
            {msg}
          </p>
        ) : null}
      </div>
    );
  }

  if (future) {
    return (
      <div className="flex flex-col gap-4">
        {!persistenceAvailable ? (
          <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-100/90">
            {persistenceReason ?? "Saving isn’t available."}{" "}
            <Link href={buildSetupUrl(`/races/${slug}`)} className="font-semibold text-amber-50 underline-offset-4 hover:underline">
              Continue setup
            </Link>
          </p>
        ) : null}
        <span className="w-fit rounded-lg border border-amber-400/45 bg-amber-500/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/90">
          On your bucket list
        </span>
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={runMarkComplete} disabled={pending || !persistenceAvailable} variant="secondary">
            {pending ? "Saving…" : "Mark as complete"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-[13px] text-muted hover:text-red-300"
            disabled={pending || !persistenceAvailable}
            onClick={runRemove}
          >
            {pending ? "Saving…" : "Remove from bucket list"}
          </Button>
          <Link
            href={OVERVIEW_PATH}
            className={cn(
              "inline-flex items-center justify-center rounded-[12px] px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.08em] transition",
              "border border-white/15 text-muted hover:border-white/30 hover:text-white"
            )}
          >
            Link Strava activity
          </Link>
        </div>
        <p className="text-[12px] text-white/45">
          Mark complete when you cross the line — Strava is optional and can be added from Overview.
        </p>
        {msg ? (
          <p className="text-sm text-amber-200/90" role="alert">
            {msg}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!persistenceAvailable ? (
        <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-100/90">
          {persistenceReason ?? "Connect the database to save bucket goals."}{" "}
          <Link href={buildSetupUrl(`/races/${slug}`)} className="font-semibold text-amber-50 underline-offset-4 hover:underline">
            Continue setup
          </Link>
        </p>
      ) : null}
      <Button type="button" onClick={runAdd} disabled={pending || !persistenceAvailable}>
        {pending ? "Saving…" : "Add to bucket list"}
      </Button>
      {msg ? (
        <p className="text-sm text-amber-200/90" role="alert">
          {msg}
        </p>
      ) : null}
    </div>
  );
}
