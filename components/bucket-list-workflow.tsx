"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  addCatalogRaceToBucketListAction,
  clearBucketListAffiliationAction,
  deleteFutureBucketGoalAction,
  markRaceNotCompletedPortfolioAction
} from "@/lib/actions";
import { StravaActivityMatchModal } from "@/components/strava-activity-match-modal";
import {
  formatDiscoverDistance,
  matchesDiscoverFilters,
  type DiscoverRace,
  type DistanceFilterId,
  type SurfaceFilterId
} from "@/lib/discover-races";
import { getPortfolioRaceLabel } from "@/lib/portfolio-race-label";
import { portfolioRaceHref } from "@/lib/profile-portfolio";
import { rankStravaActivitiesForDiscoverRace, stravaActivitiesToPickListCandidates } from "@/lib/strava-race-candidates";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Race, StravaFeedActivity } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  futureGoals: Race[];
  completedBucketRaces: Race[];
  /** Full merged catalog for search (same source as matchers). */
  catalogRaces: DiscoverRace[];
  raceCandidates: StravaFeedActivity[];
  usedStravaIds: string[];
  stravaOk: boolean;
  stravaOAuthConfigured: boolean;
};

export function BucketListWorkflow({
  futureGoals,
  completedBucketRaces,
  catalogRaces,
  raceCandidates,
  usedStravaIds,
  stravaOk,
  stravaOAuthConfigured
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const [addPending, startAdd] = useTransition();
  const [rowPending, startRow] = useTransition();
  const [completingGoal, setCompletingGoal] = useState<Race | null>(null);

  const usedSet = useMemo(() => new Set(usedStravaIds), [usedStravaIds]);

  const searchResults = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    return catalogRaces
      .filter((r) => matchesDiscoverFilters(r, q, "any" as DistanceFilterId, "any" as SurfaceFilterId))
      .slice(0, 14);
  }, [catalogRaces, query]);

  const completionCandidates = useMemo(() => {
    if (!completingGoal) return [];
    const did = completingGoal.discover_race_id?.trim();
    if (did) {
      return rankStravaActivitiesForDiscoverRace(did, raceCandidates, usedSet);
    }
    return stravaActivitiesToPickListCandidates(raceCandidates, usedSet, {
      goalDistanceKm: completingGoal.distance_km
    });
  }, [completingGoal, raceCandidates, usedSet]);

  const runAddFromCatalog = (discoverId: string) => {
    setSearchMsg(null);
    startAdd(async () => {
      const fd = new FormData();
      fd.set("discover_race_id", discoverId);
      const res = await addCatalogRaceToBucketListAction(fd);
      if ("error" in res && res.error) {
        setSearchMsg(res.error);
        return;
      }
      if ("already" in res && res.already) {
        setSearchMsg("That race is already on your bucket list as a future goal.");
      } else {
        setSearchMsg("Added to Future Goals.");
      }
      setQuery("");
      router.refresh();
    });
  };

  const runDeleteFuture = (raceId: string) => {
    startRow(async () => {
      const fd = new FormData();
      fd.set("race_id", raceId);
      const res = await deleteFutureBucketGoalAction(fd);
      if ("error" in res && res.error) {
        setSearchMsg(res.error);
        return;
      }
      router.refresh();
    });
  };

  const runUndoComplete = (raceId: string) => {
    startRow(async () => {
      const fd = new FormData();
      fd.set("race_id", raceId);
      const res = await markRaceNotCompletedPortfolioAction(fd);
      if ("error" in res && res.error) {
        setSearchMsg(res.error);
        return;
      }
      router.refresh();
    });
  };

  const runDropBucketBadge = (raceId: string) => {
    startRow(async () => {
      const fd = new FormData();
      fd.set("race_id", raceId);
      const res = await clearBucketListAffiliationAction(fd);
      if ("error" in res && res.error) {
        setSearchMsg(res.error);
        return;
      }
      router.refresh();
    });
  };

  const completingTitle = completingGoal ? getPortfolioRaceLabel(completingGoal) : "";
  const completingLocation = completingGoal?.location?.trim() ?? "";

  return (
    <div className="space-y-12">
      {searchMsg ? (
        <p className="text-sm text-amber-200/90" role="status">
          {searchMsg}
        </p>
      ) : null}

      <section className="space-y-4">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">Search all races</h2>
          <p className="type-meta mt-2 max-w-2xl text-sm">
            Pull any event from the Runfolio race library into your goals. Adding here creates a future goal — you prove the
            finish with Strava when you&apos;re ready.
          </p>
        </div>
        <Card className="border-white/10 bg-panelAlt/80 p-4 md:p-5">
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchMsg(null);
            }}
            placeholder="Search by race name, alias, or location…"
            className="max-w-xl border-white/15 bg-black/40"
          />
          {query.trim().length >= 2 && searchResults.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No matches — try another spelling or browse the full library.</p>
          ) : null}
          {searchResults.length > 0 ? (
            <ul className="mt-4 divide-y divide-white/10 rounded-[12px] border border-white/10 bg-black/30">
              {searchResults.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{r.name}</p>
                    <p className="type-meta mt-1 text-xs text-muted">
                      {formatDiscoverDistance(r.distance_km, r.multi_day)} · {r.location}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link
                      href={`/races/${r.id}`}
                      className="inline-flex items-center justify-center rounded-[10px] border border-white/15 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted transition hover:border-white/30 hover:text-white"
                    >
                      Details
                    </Link>
                    <Button
                      type="button"
                      disabled={addPending}
                      onClick={() => runAddFromCatalog(r.id)}
                      className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider"
                    >
                      {addPending ? "Adding…" : "Add to future goals"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-4 text-[11px] text-muted">
            Prefer browsing?{" "}
            <Link href="/races/find" className="text-accent underline-offset-4 hover:underline">
              Open the full race library
            </Link>
            .
          </p>
        </Card>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/90">Future goals</h2>
          <p className="type-meta mt-2 max-w-2xl text-sm">
            These are races you intend to run. Mark one complete only after you link and confirm the real Strava activity —
            that keeps your bucket list honest.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {futureGoals.length === 0 ? (
            <Card className="col-span-full border-dashed border-white/12 bg-panel/35 p-8 text-center md:col-span-2">
              <p className="text-sm font-medium text-white">No future goals yet</p>
              <p className="type-meta mx-auto mt-2 max-w-lg text-xs">
                Search above or visit the library — your picks land here as to-do races.
              </p>
            </Card>
          ) : (
            futureGoals.map((race) => {
              const label = getPortfolioRaceLabel(race);
              const catalogHref = race.discover_race_id?.trim()
                ? `/races/${race.discover_race_id.trim()}`
                : null;
              return (
                <Card key={race.id} className="border-amber-500/20 bg-panelAlt/90 p-5">
                  <p className="font-semibold uppercase tracking-[0.04em] text-white">{label}</p>
                  <p className="type-meta mt-2 text-sm">
                    {race.distance_km != null ? `${race.distance_km} km` : "—"} · {race.location ?? "Location TBD"}
                  </p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button
                      type="button"
                      className="bg-accent text-[11px] font-semibold uppercase tracking-wider"
                      onClick={() => setCompletingGoal(race)}
                    >
                      Mark as complete…
                    </Button>
                    {catalogHref ? (
                      <Link
                        href={catalogHref}
                        className="inline-flex items-center justify-center rounded-[12px] border border-white/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted transition hover:border-white/30 hover:text-white"
                      >
                        Race page
                      </Link>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-[11px] text-muted hover:text-red-300"
                      disabled={rowPending}
                      onClick={() => runDeleteFuture(race.id)}
                    >
                      Remove goal
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">Completed races</h2>
          <p className="type-meta mt-2 max-w-2xl text-sm">
            Goals you finished and proved with Strava. Undo moves a row back to Future Goals and clears the activity link.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {completedBucketRaces.length === 0 ? (
            <Card className="col-span-full border-dashed border-white/12 bg-panel/35 p-8 text-center md:col-span-2">
              <p className="text-sm font-medium text-white">No bucket-list finishes yet</p>
              <p className="type-meta mx-auto mt-2 max-w-lg text-xs">
                Complete a future goal by linking your Strava activity — then it appears here and across your profile,
                journey, and collections.
              </p>
            </Card>
          ) : (
            completedBucketRaces.map((race) => {
              const label = getPortfolioRaceLabel(race);
              const catalogHref = race.discover_race_id?.trim()
                ? `/races/${race.discover_race_id.trim()}`
                : null;
              return (
                <Card key={race.id} className="border-green-500/15 bg-panelAlt/90 p-5">
                  <p className="font-semibold uppercase tracking-[0.04em] text-white">{label}</p>
                  <p className="type-meta mt-2 text-sm">
                    {race.distance_km != null ? `${race.distance_km} km` : "—"} · {race.location ?? "—"} ·{" "}
                    {race.date ?? "Date TBD"}
                  </p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Link
                      href={portfolioRaceHref(race)}
                      className={cn(
                        "inline-flex items-center justify-center rounded-[12px] border border-gold/35 bg-gold/10 px-4 py-2",
                        "text-[11px] font-semibold uppercase tracking-wider text-gold transition hover:bg-gold/15"
                      )}
                    >
                      Open finish
                    </Link>
                    {race.strava_activity_id ? (
                      <Link
                        href={`/activities/${race.strava_activity_id}`}
                        className="inline-flex items-center justify-center rounded-[12px] border border-white/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-white transition hover:border-white/30"
                      >
                        Linked activity
                      </Link>
                    ) : null}
                    {catalogHref ? (
                      <Link
                        href={catalogHref}
                        className="inline-flex items-center justify-center rounded-[12px] border border-white/12 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted transition hover:text-white"
                      >
                        Library
                      </Link>
                    ) : null}
                    <Button
                      type="button"
                      variant="secondary"
                      className="text-[11px]"
                      disabled={rowPending}
                      onClick={() => runUndoComplete(race.id)}
                    >
                      Undo finish → back to goals
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-[11px] text-muted hover:text-amber-200"
                      disabled={rowPending}
                      onClick={() => runDropBucketBadge(race.id)}
                    >
                      Keep finish, drop bucket badge
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </section>

      <StravaActivityMatchModal
        open={Boolean(completingGoal)}
        onClose={() => setCompletingGoal(null)}
        discoverRaceId={completingGoal?.discover_race_id?.trim() ?? null}
        raceDisplayTitle={completingTitle}
        discoverLocation={completingLocation}
        bucketFutureRaceId={completingGoal?.id ?? null}
        returnTo="/bucket-list"
        stravaCandidates={completionCandidates}
        stravaOk={stravaOk}
        stravaOAuthConfigured={stravaOAuthConfigured}
      />
    </div>
  );
}
