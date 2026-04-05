"use client";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  confirmCanonicalStravaMatchAction,
  markStravaActivityNotRaceAction,
  snoozeStravaActivityMatchHubAction,
  unsnoozeStravaActivityMatchHubAction
} from "@/lib/actions";
import type { MatchHubBundle } from "@/lib/match-hub/service";
import type { StravaSyncedActivityRow } from "@/lib/strava-sync/types";
import { ManualRaceLinkPanel } from "@/components/manual-race-link-panel";
import { PortfolioRaceCard } from "@/components/my-races/portfolio-race-card";
import { SuggestedRaceCard } from "@/components/my-races/race-card";
import { ProfilePendingRaceCandidates } from "@/components/profile-pending-race-candidates";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buildSetupUrl } from "@/lib/setup-url";
import { getPortfolioRaceLabel } from "@/lib/portfolio-race-label";
import { cn } from "@/lib/utils";
import type { ProfilePendingRaceCandidate, Race } from "@/types";

const RETURN_TO = "/my-races";

type TabId = "completed" | "review";

type Props = {
  initialBundle: MatchHubBundle;
  portfolioRaces: Race[];
  profileHref: string;
  completedRacesHref: string;
  stravaOAuthConfigured: boolean;
  initialTab: TabId;
  profilePendingCandidates: ProfilePendingRaceCandidate[];
  pendingReviewReturnTo: string;
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

function sortRacesByDateDesc(races: Race[]): Race[] {
  return [...races].sort((a, b) => {
    const ta = a.date ? new Date(`${a.date}T12:00:00`).getTime() : 0;
    const tb = b.date ? new Date(`${b.date}T12:00:00`).getTime() : 0;
    return tb - ta;
  });
}

export function MyRacesClient({
  initialBundle,
  portfolioRaces,
  profileHref,
  completedRacesHref,
  stravaOAuthConfigured,
  initialTab,
  profilePendingCandidates,
  pendingReviewReturnTo
}: Props) {
  const router = useRouter();
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [tab, setTab] = useState<TabId>(initialTab);
  const [search, setSearch] = useState("");

  const { suggestedHigh, unmatched, snoozed, totalSyncedCount } = initialBundle;

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

  const queueCount = filteredHigh.length + filteredUnmatched.length + snoozed.length;

  const hubStravaIds = useMemo(() => {
    const s = new Set<string>();
    for (const x of suggestedHigh) s.add(x.stravaActivityId);
    for (const u of unmatched) s.add(u.row.strava_activity_id);
    for (const z of snoozed) s.add(z.row.strava_activity_id);
    return s;
  }, [suggestedHigh, unmatched, snoozed]);

  const profilePendingOnly = useMemo(
    () => profilePendingCandidates.filter((p) => !hubStravaIds.has(p.stravaId)),
    [profilePendingCandidates, hubStravaIds]
  );

  const needsReviewBadgeCount = queueCount + profilePendingOnly.length;

  const sortedPortfolio = useMemo(() => sortRacesByDateDesc(portfolioRaces), [portfolioRaces]);

  const searchNeedle = search.trim().toLowerCase();
  const portfolioForTab = useMemo(() => {
    const base = sortedPortfolio.filter((r) => r.is_completed);
    if (!searchNeedle) return base;
    return base.filter((r) => getPortfolioRaceLabel(r).toLowerCase().includes(searchNeedle));
  }, [sortedPortfolio, searchNeedle]);

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "completed", label: "Completed" },
    { id: "review", label: "Needs Review", count: needsReviewBadgeCount }
  ];

  return (
    <div className="space-y-8">
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
              <Link
                href={profileHref}
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-emerald-500/85 px-4 text-[12px] font-semibold uppercase tracking-wider text-[#0a1210]"
              >
                Profile
              </Link>
            ) : null}
            <button type="button" className="min-h-[44px] text-left text-[12px] text-white/45 hover:text-white/65" onClick={() => setBanner(null)}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <div
        className="flex w-full gap-2 border-b border-white/10 pb-3"
        role="tablist"
        aria-label="My Races views"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={cn(
              "min-h-[48px] min-w-0 flex-1 rounded-full px-3 text-[11px] font-semibold uppercase tracking-wider transition sm:px-4 sm:text-[12px]",
              tab === t.id ? "bg-white/[0.14] text-white" : "text-white/50 hover:text-white/75"
            )}
            onClick={() => setTab(t.id)}
          >
            <span className="block truncate text-center">
              {t.label}
              {t.id === "review" && t.count != null && t.count > 0 ? (
                <span className="ml-1 tabular-nums text-white/65">({t.count})</span>
              ) : null}
            </span>
          </button>
        ))}
      </div>

      {tab === "review" && !stravaOAuthConfigured ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-950/15 px-4 py-3 text-sm text-amber-100/85">
          Strava isn&apos;t enabled here — use{" "}
          <Link href="/races/find" className="font-medium text-amber-200 underline-offset-4 hover:underline">
            Find
          </Link>{" "}
          or{" "}
          <Link href="/races/new" className="font-medium text-amber-200 underline-offset-4 hover:underline">
            Add race
          </Link>
          .
        </p>
      ) : null}

      {tab === "completed" ? (
        <div className="space-y-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by race name"
            className="h-12 rounded-xl border-white/12 bg-panel/40 text-white placeholder:text-white/35"
            aria-label="Search races"
          />

          {portfolioForTab.length === 0 ? (
            <Card className="border border-dashed border-white/15 bg-panel/25 px-4 py-10 text-center">
              {sortedPortfolio.length === 0 ? (
                <>
                  <p className="font-medium text-white/90">Your portfolio is empty</p>
                  <p className="mt-2 text-sm text-white/50">Import from Strava to add finishes.</p>
                  <div className="mt-6 flex flex-col gap-2 sm:mx-auto sm:max-w-xs">
                    {stravaOAuthConfigured ? (
                      <Link
                        href="#import-strava"
                        className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-accent px-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-gold-hover"
                      >
                        Import from Strava
                      </Link>
                    ) : null}
                    <Link
                      href="/races/new"
                      className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] text-[12px] font-semibold uppercase tracking-[0.1em] text-white/90"
                    >
                      Add a race
                    </Link>
                    <Link
                      href={buildSetupUrl(RETURN_TO)}
                      className="text-[12px] font-medium text-teal underline-offset-4 hover:text-teal-hover hover:underline"
                    >
                      Setup Strava
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <p className="font-medium text-white/90">No completed races here yet</p>
                  <p className="mt-2 text-sm text-white/50">
                    {searchNeedle ? "Try a different search." : "Finish a goal or link a Strava activity."}
                  </p>
                </>
              )}
            </Card>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {portfolioForTab.map((race) => (
                <li key={race.id}>
                  <PortfolioRaceCard race={race} achievementEmphasis />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "review" ? (
        <section
          id="needs-review"
          data-section="needs-review"
          className="scroll-mt-24 space-y-3"
          aria-label="Races and activities to review"
        >
          {needsReviewBadgeCount === 0 ? (
            <Card className="border border-white/10 bg-panel/25 px-4 py-8 text-center">
              <p className="font-medium text-white/90">No pending races to review</p>
              <Link
                href={completedRacesHref}
                className="mt-5 inline-block min-h-[44px] text-[12px] font-semibold text-teal underline-offset-4 hover:text-teal-hover hover:underline"
              >
                View completed on profile
              </Link>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {profilePendingOnly.length > 0 ? (
                <ProfilePendingRaceCandidates candidates={profilePendingOnly} returnTo={pendingReviewReturnTo} />
              ) : null}

              {queueCount > 0 ? (
                <ul className="flex flex-col gap-2.5">
                  {filteredHigh.map((s) => (
                    <li key={s.stravaActivityId}>
                      <SuggestedRaceCard
                        suggestion={s}
                        pending={pending}
                        onConfirm={confirmMatch}
                        onNotRace={notRace}
                      />
                    </li>
                  ))}
                  {filteredUnmatched.map(({ row, softSuggestions }, idx) => (
                    <li
                      key={row.strava_activity_id}
                      id={idx === 0 ? "my-races-unmatched" : undefined}
                      className={idx === 0 ? "scroll-mt-24" : undefined}
                    >
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
                  {snoozed.map(({ row }) => {
                    const m = activityMeta(row);
                    return (
                      <li key={row.strava_activity_id}>
                        <Card className="flex flex-col gap-2 border border-white/10 bg-panel/30 p-3 sm:p-3.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Later</p>
                          <div>
                            <p className="text-[15px] font-medium text-white">{m.title}</p>
                            <p className="mt-0.5 text-[12px] text-white/55">
                              {m.date} · {m.km ? `${m.km} km` : "—"}
                              {m.el != null && m.el > 0 ? ` · ${Math.round(m.el)} m` : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={pending}
                            className="min-h-[44px] w-full rounded-[12px] border border-border bg-panelAlt text-[11px] font-semibold uppercase tracking-wider text-white transition hover:bg-slate-800 disabled:opacity-60"
                            onClick={() => unsnooze(row.strava_activity_id)}
                          >
                            Back to queue
                          </button>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          )}

          {!stravaOAuthConfigured && totalSyncedCount === 0 && queueCount === 0 ? (
            <p className="text-center text-sm text-white/45">
              <Link href={buildSetupUrl(RETURN_TO)} className="font-semibold text-teal underline-offset-4 hover:text-teal-hover hover:underline">
                Setup
              </Link>{" "}
              Strava to import activities.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
