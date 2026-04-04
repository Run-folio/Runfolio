"use client";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  confirmCanonicalStravaMatchAction,
  dismissCanonicalStravaMatchAction,
  markStravaActivityNotRaceAction,
  snoozeStravaActivityMatchHubAction,
  unsnoozeStravaActivityMatchHubAction
} from "@/lib/actions";
import type { MatchHubBundle } from "@/lib/match-hub/service";
import type { StravaSyncedActivityRow } from "@/lib/strava-sync/types";
import { ManualRaceLinkPanel } from "@/components/manual-race-link-panel";
import { MatchedRaceCard, SuggestedRaceCard } from "@/components/my-races/race-card";
import { StravaIncrementalSyncButton } from "@/components/strava-incremental-sync-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { buildSetupUrl } from "@/lib/setup-url";
import { cn } from "@/lib/utils";

const RETURN_TO = "/my-races";

type Props = {
  initialBundle: MatchHubBundle;
  profileHref: string;
  completedRacesHref: string;
  profileFinishHref: string;
  stravaOAuthConfigured: boolean;
  liveStravaActivityCount?: number | null;
};

function activityMeta(row: StravaSyncedActivityRow) {
  return {
    title: row.name,
    date: row.start_date.slice(0, 10),
    km: row.distance_km ?? 0,
    el: row.elevation_gain_m,
    id: row.strava_activity_id
  };
}

function QuietState({
  totalSyncedCount,
  stravaOAuthConfigured,
  liveStravaActivityCount,
  completedRacesHref
}: {
  totalSyncedCount: number;
  stravaOAuthConfigured: boolean;
  liveStravaActivityCount?: number | null;
  completedRacesHref: string;
}) {
  if (totalSyncedCount === 0) {
    return (
      <Card className="border border-dashed border-white/15 bg-panel/25 px-4 py-10 text-center">
        <p className="font-medium text-white/90">
          {liveStravaActivityCount != null && liveStravaActivityCount > 0 ? "Nothing saved yet" : "No activities in Runfolio"}
        </p>
        <p className="mt-2 text-sm text-white/50">
          {stravaOAuthConfigured ? "Use Import from Strava above, then sync new activities from the header." : "Add a race from Find or Add race — Strava isn’t configured here."}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:mx-auto sm:max-w-xs">
          <Link
            href={buildSetupUrl(RETURN_TO)}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] text-[12px] font-semibold uppercase tracking-[0.1em] text-white/90"
          >
            Setup
          </Link>
        </div>
      </Card>
    );
  }
  return (
    <Card className="border border-white/10 bg-panel/25 px-4 py-6 text-center">
      <p className="font-medium text-white/90">You&apos;re caught up</p>
      <p className="mt-1 text-sm text-white/50">{totalSyncedCount} activit{totalSyncedCount === 1 ? "y" : "ies"} saved — nothing needs action.</p>
      <Link href={completedRacesHref} className="mt-4 inline-block text-[12px] font-semibold text-accent hover:underline">
        Completed races →
      </Link>
    </Card>
  );
}

function EmptyBlock({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-[#0a0d14]/80 px-4 py-8 text-center">
      <p className="text-sm font-medium text-white/75">{title}</p>
      {children ? <div className="mt-4 flex flex-col gap-2">{children}</div> : null}
    </div>
  );
}

export function MyRacesClient({
  initialBundle,
  profileHref,
  completedRacesHref,
  profileFinishHref,
  stravaOAuthConfigured,
  liveStravaActivityCount
}: Props) {
  const router = useRouter();
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());

  const { suggestedHigh, unmatched, snoozed, recentlyConfirmed, totalSyncedCount } = initialBundle;

  const serverQueueSize = useMemo(
    () => initialBundle.suggestedHigh.length + initialBundle.unmatched.length + initialBundle.snoozed.length,
    [initialBundle]
  );

  const showQuiet =
    hiddenIds.size === 0 && serverQueueSize === 0 && initialBundle.recentlyConfirmed.length === 0;

  useEffect(() => {
    setHiddenIds((prev) => {
      if (prev.size === 0) return prev;
      const alive = new Set<string>([
        ...suggestedHigh.map((s) => s.stravaActivityId),
        ...unmatched.map((u) => u.row.strava_activity_id)
      ]);
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (alive.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [suggestedHigh, unmatched]);

  const hideId = (stravaActivityId: string) => {
    setHiddenIds((prev) => new Set(prev).add(stravaActivityId));
  };

  const unhideId = (stravaActivityId: string) => {
    setHiddenIds((prev) => {
      const n = new Set(prev);
      n.delete(stravaActivityId);
      return n;
    });
  };

  const dismiss = (stravaActivityId: string) => {
    hideId(stravaActivityId);
    start(async () => {
      setBanner(null);
      const fd = new FormData();
      fd.set("strava_activity_id", stravaActivityId);
      const r = await dismissCanonicalStravaMatchAction(fd);
      if ("error" in r && r.error) {
        unhideId(stravaActivityId);
        setBanner({ kind: "err", text: String(r.error) });
      } else {
        setBanner({ kind: "ok", text: "Suggestion cleared — you can still match this activity manually." });
        router.refresh();
      }
    });
  };

  const notRace = (stravaActivityId: string) => {
    hideId(stravaActivityId);
    start(async () => {
      setBanner(null);
      const fd = new FormData();
      fd.set("strava_activity_id", stravaActivityId);
      const r = await markStravaActivityNotRaceAction(fd);
      if ("error" in r && r.error) {
        unhideId(stravaActivityId);
        setBanner({ kind: "err", text: String(r.error) });
      } else {
        setBanner({ kind: "ok", text: "Marked as not a race." });
        router.refresh();
      }
    });
  };

  const snooze = (stravaActivityId: string) => {
    hideId(stravaActivityId);
    start(async () => {
      setBanner(null);
      const fd = new FormData();
      fd.set("strava_activity_id", stravaActivityId);
      const r = await snoozeStravaActivityMatchHubAction(fd);
      if ("error" in r && r.error) {
        unhideId(stravaActivityId);
        setBanner({ kind: "err", text: String(r.error) });
      } else {
        setBanner({ kind: "ok", text: "Saved for later." });
        router.refresh();
      }
    });
  };

  const unsnooze = (stravaActivityId: string) => {
    start(async () => {
      const fd = new FormData();
      fd.set("strava_activity_id", stravaActivityId);
      await unsnoozeStravaActivityMatchHubAction(fd);
      router.refresh();
    });
  };

  const confirmMatch = (fd: FormData, stravaActivityId: string) => {
    hideId(stravaActivityId);
    start(async () => {
      setBanner(null);
      fd.set("response_mode", "hub");
      fd.set("return_to", RETURN_TO);
      try {
        const res = await confirmCanonicalStravaMatchAction(fd);
        if (res && typeof res === "object" && "error" in res && res.error) {
          unhideId(stravaActivityId);
          setBanner({ kind: "err", text: String(res.error) });
          return;
        }
        if (res && typeof res === "object" && "ok" in res && res.ok) {
          setBanner({ kind: "ok", text: "Finish saved — it’s on your profile." });
          router.refresh();
        }
      } catch (e: unknown) {
        if (isRedirectError(e)) throw e;
        unhideId(stravaActivityId);
        setBanner({ kind: "err", text: "Something went wrong — try again." });
      }
    });
  };

  const filteredHigh = useMemo(
    () => suggestedHigh.filter((s) => !hiddenIds.has(s.stravaActivityId)),
    [suggestedHigh, hiddenIds]
  );
  const filteredUnmatched = useMemo(
    () => unmatched.filter((u) => !hiddenIds.has(u.row.strava_activity_id)),
    [unmatched, hiddenIds]
  );

  return (
    <div className="space-y-10">
      {banner ? (
        <div
          role="status"
          className={cn(
            "rounded-xl border px-4 py-4",
            banner.kind === "ok" ? "border-emerald-400/30 bg-emerald-950/30 text-emerald-50" : "border-red-400/30 bg-red-950/25 text-red-100"
          )}
        >
          <p className="text-sm">{banner.text}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {banner.kind === "ok" ? (
              <>
                <Link
                  href={profileHref}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-500/85 px-4 text-[11px] font-semibold uppercase tracking-wider text-[#0a1210]"
                >
                  Profile
                </Link>
                <Link
                  href={completedRacesHref}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-emerald-400/35 px-4 text-[11px] font-semibold uppercase tracking-wider text-emerald-50"
                >
                  Completed races
                </Link>
                <Link href={profileFinishHref} className="inline-flex min-h-[44px] items-center text-[11px] text-emerald-200/80 underline-offset-4 hover:underline sm:items-center">
                  Highlight finish →
                </Link>
              </>
            ) : null}
            <button type="button" className="text-left text-[11px] text-white/45 hover:text-white/65" onClick={() => setBanner(null)}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {!stravaOAuthConfigured ? (
        <Card className="border-amber-500/25 bg-amber-950/15 p-4 text-sm text-amber-100/85">
          Strava OAuth isn&apos;t configured here. Add finishes via{" "}
          <Link href="/races/find" className="font-medium text-amber-200 underline-offset-4 hover:underline">
            Find a race
          </Link>{" "}
          or{" "}
          <Link href="/races/new" className="font-medium text-amber-200 underline-offset-4 hover:underline">
            Add race
          </Link>
          .
        </Card>
      ) : null}

      {stravaOAuthConfigured ? (
        <div className="flex flex-col gap-2 sm:max-w-md">
          <StravaIncrementalSyncButton className="min-h-[48px] w-full" />
        </div>
      ) : null}

      <section id="my-races-queue" className="scroll-mt-24 space-y-6">
        {showQuiet ? (
          <QuietState
            totalSyncedCount={totalSyncedCount}
            stravaOAuthConfigured={stravaOAuthConfigured}
            liveStravaActivityCount={liveStravaActivityCount}
            completedRacesHref={completedRacesHref}
          />
        ) : null}

        {filteredHigh.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">Suggested</h2>
            <ul className="flex flex-col gap-4">
              {filteredHigh.map((s) => (
                <li key={s.stravaActivityId}>
                  <SuggestedRaceCard suggestion={s} pending={pending} onConfirm={confirmMatch} onChange={dismiss} />
                </li>
              ))}
            </ul>
          </div>
        ) : !showQuiet && totalSyncedCount > 0 && (filteredUnmatched.length > 0 || snoozed.length > 0) ? (
          <EmptyBlock title="No auto-suggestions">
            <Link
              href="#my-races-unmatched"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/15 px-4 text-[12px] font-semibold uppercase tracking-wider text-white/85"
            >
              Manual match →
            </Link>
          </EmptyBlock>
        ) : null}

        {filteredUnmatched.length > 0 ? (
          <div id="my-races-unmatched" className="scroll-mt-24 space-y-3">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">Needs a race</h2>
            <ul className="flex flex-col gap-4">
              {filteredUnmatched.map(({ row, softSuggestions }) => (
                <li key={row.strava_activity_id}>
                  <ManualRaceLinkPanel
                    ctx={{
                      stravaActivityId: row.strava_activity_id,
                      activityTitle: row.name,
                      startDateYmd: row.start_date.slice(0, 10),
                      distanceKm: row.distance_km ?? 0,
                      elevationM: row.elevation_gain_m ?? null
                    }}
                    softSuggestions={softSuggestions}
                    pending={pending}
                    onConfirm={confirmMatch}
                    responseMode="hub"
                    returnTo={RETURN_TO}
                    onNotRace={() => notRace(row.strava_activity_id)}
                    onSnooze={() => snooze(row.strava_activity_id)}
                    compact
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : !showQuiet && totalSyncedCount > 0 && (filteredHigh.length > 0 || snoozed.length > 0) ? (
          <EmptyBlock title="Nothing needs manual match" />
        ) : null}

        {snoozed.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Saved for later</h2>
            <ul className="flex flex-col gap-3">
              {snoozed.map(({ row }) => {
                const m = activityMeta(row);
                return (
                  <li key={row.strava_activity_id}>
                    <Card className="flex flex-col gap-3 border border-white/10 bg-panel/30 p-4">
                      <div>
                        <p className="font-medium text-white">{m.title}</p>
                        <p className="mt-1 text-sm text-white/55">
                          {m.date} · {m.km ? `${m.km} km` : "—"}
                          {m.el != null && m.el > 0 ? ` · ${Math.round(m.el)} m` : ""}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={pending}
                        className="min-h-[48px] w-full"
                        onClick={() => unsnooze(row.strava_activity_id)}
                      >
                        Back to queue
                      </Button>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/75">Recently linked</h2>
        {recentlyConfirmed.length === 0 ? (
          <EmptyBlock title="No recent links from this page">
            <Link href={completedRacesHref} className="text-[12px] font-semibold text-emerald-300/90 hover:underline">
              View completed races →
            </Link>
          </EmptyBlock>
        ) : (
          <ul className="flex flex-col gap-3">
            {recentlyConfirmed.map((r) => (
              <li key={r.id}>
                <MatchedRaceCard finish={r} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
