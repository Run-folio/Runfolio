"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  addCanonicalRaceToBucketListAction,
  addCatalogRaceToBucketListAction,
  clearBucketListAffiliationAction,
  deleteFutureBucketGoalAction,
  markCanonicalBucketGoalCompletedAction,
  markRaceNotCompletedPortfolioAction,
  removeCanonicalBucketGoalAction,
  undoCanonicalBucketCompletionAction
} from "@/lib/actions";
import type { CanonicalBucketGoalView } from "@/lib/bucket-list-canonical/types";
import { BUCKET_LIST_FEATURED_DISCOVER_IDS } from "@/lib/bucket-list-featured";
import { formatRaceMonth } from "@/lib/format-race-date";
import { StravaActivityMatchModal } from "@/components/strava-activity-match-modal";
import { formatDiscoverDistance, matchesDiscoverFilters, type DiscoverRace } from "@/lib/discover-races";
import { getPortfolioRaceLabel } from "@/lib/portfolio-race-label";
import { portfolioRaceHref } from "@/lib/profile-portfolio";
import { getDiscoverRaceById } from "@/lib/known-race-match";
import { getRaceSceneImagePath } from "@/lib/race-scene-images";
import type { SearchableRaceRow } from "@/lib/races/canonical/types";
import {
  discoverStubForBucketManualPick,
  isStravaManualLinkPoolActivity,
  rankStravaActivitiesForDiscoverRace,
  stravaActivitiesToPickListCandidates
} from "@/lib/strava-race-candidates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DiscoverStravaActivityCandidate, Race, StravaFeedActivity } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  canonicalFuture: CanonicalBucketGoalView[];
  canonicalCompleted: CanonicalBucketGoalView[];
  futureGoals: Race[];
  completedBucketRaces: Race[];
  catalogRaces: DiscoverRace[];
  stravaActivities: StravaFeedActivity[];
  usedStravaIds: string[];
  stravaOk: boolean;
  stravaOAuthConfigured: boolean;
  stravaFeedErrorMessage?: string;
  stravaSyncedActivityCount?: number;
};

function formatCanonKm(km: number | null): string {
  if (km == null || Number.isNaN(km)) return "—";
  if (km >= 100) return `${Math.round(km)} km`;
  return `${km % 1 === 0 ? km : km.toFixed(1)} km`;
}

function discoverImage(race: DiscoverRace): string {
  return getRaceSceneImagePath(race.name);
}

function canonicalCardImage(g: CanonicalBucketGoalView): string | null {
  const h = g.heroImageUrl?.trim() || g.logoUrl?.trim();
  return h || null;
}

type SearchRow =
  | { kind: "discover"; race: DiscoverRace }
  | { kind: "canonical"; race: SearchableRaceRow };

export function BucketListWorkflow({
  canonicalFuture,
  canonicalCompleted,
  futureGoals,
  completedBucketRaces,
  catalogRaces,
  stravaActivities,
  usedStravaIds,
  stravaOk,
  stravaOAuthConfigured,
  stravaFeedErrorMessage,
  stravaSyncedActivityCount
}: Props) {
  const router = useRouter();
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [canonicalHits, setCanonicalHits] = useState<SearchableRaceRow[] | null>(null);
  const [canSearchLoading, setCanSearchLoading] = useState(false);
  const [addPending, startAdd] = useTransition();
  const [rowPending, startRow] = useTransition();
  const [completingGoal, setCompletingGoal] = useState<Race | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);

  const usedSet = useMemo(() => new Set(usedStravaIds), [usedStravaIds]);

  const discoverGoalIds = useMemo(
    () => new Set(futureGoals.map((r) => r.discover_race_id?.trim()).filter(Boolean) as string[]),
    [futureGoals]
  );
  const canonicalGoalIds = useMemo(
    () => new Set([...canonicalFuture, ...canonicalCompleted].map((g) => g.canonical_race_id)),
    [canonicalFuture, canonicalCompleted]
  );

  const featuredRaces = useMemo(() => {
    const list: DiscoverRace[] = [];
    for (const id of BUCKET_LIST_FEATURED_DISCOVER_IDS) {
      const r = catalogRaces.find((x) => x.id === id);
      if (r) list.push(r);
    }
    return list;
  }, [catalogRaces]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 220);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setCanonicalHits(null);
      setCanSearchLoading(false);
      return;
    }
    let cancelled = false;
    setCanSearchLoading(true);
    const u = new URL("/api/races/canonical/search", window.location.origin);
    u.searchParams.set("query", debouncedQuery);
    u.searchParams.set("limit", "12");
    fetch(u.toString())
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        if (body?.ok && Array.isArray(body.races)) setCanonicalHits(body.races as SearchableRaceRow[]);
        else setCanonicalHits([]);
      })
      .catch(() => {
        if (!cancelled) setCanonicalHits([]);
      })
      .finally(() => {
        if (!cancelled) setCanSearchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!highlightKey) return;
    const t = window.setTimeout(() => setHighlightKey(null), 1400);
    return () => window.clearTimeout(t);
  }, [highlightKey]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!searchWrapRef.current?.contains(e.target as Node)) setSearchFocused(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const discoverHits = useMemo(() => {
    const q = debouncedQuery;
    if (q.length < 2) return [];
    return catalogRaces.filter((r) => matchesDiscoverFilters(r, q, "any", "any")).slice(0, 10);
  }, [catalogRaces, debouncedQuery]);

  const mergedSearchRows: SearchRow[] = useMemo(() => {
    const rows: SearchRow[] = discoverHits.map((race) => ({ kind: "discover", race }));
    const canon = canonicalHits ?? [];
    for (const race of canon) {
      rows.push({ kind: "canonical", race });
    }
    return rows;
  }, [discoverHits, canonicalHits]);

  const showSearchPanel = searchFocused && debouncedQuery.length >= 2;

  const bumpAdded = useCallback(
    (key: string, message: string) => {
      setToast(message);
      setHighlightKey(key);
      setQuery("");
      setSearchFocused(false);
      inputRef.current?.blur();
      router.refresh();
    },
    [router]
  );

  const runAddDiscover = (discoverId: string) => {
    startAdd(async () => {
      const fd = new FormData();
      fd.set("discover_race_id", discoverId);
      const res = await addCatalogRaceToBucketListAction(fd);
      if ("error" in res && res.error) {
        setToast(res.error);
        return;
      }
      if ("already" in res && res.already) bumpAdded(`disc-${discoverId}`, "Already on your goals");
      else bumpAdded(`disc-${discoverId}`, "Added to your goals");
    });
  };

  const runAddCanonical = (canonicalId: string) => {
    startAdd(async () => {
      const fd = new FormData();
      fd.set("canonical_race_id", canonicalId);
      const res = await addCanonicalRaceToBucketListAction(fd);
      if ("error" in res && res.error) {
        setToast(res.error);
        return;
      }
      if ("already" in res && res.already) bumpAdded(`can-${canonicalId}`, "Already on your goals");
      else bumpAdded(`can-${canonicalId}`, "Added to your goals");
    });
  };

  const pickSearchRow = (row: SearchRow) => {
    if (addPending) return;
    if (row.kind === "discover") runAddDiscover(row.race.id);
    else runAddCanonical(row.race.id);
  };

  const runDeleteFuture = (raceId: string) => {
    startRow(async () => {
      const fd = new FormData();
      fd.set("race_id", raceId);
      const res = await deleteFutureBucketGoalAction(fd);
      if ("error" in res && res.error) setToast(res.error);
      else {
        setToast("Removed");
        router.refresh();
      }
    });
  };

  const runUndoComplete = (raceId: string) => {
    startRow(async () => {
      const fd = new FormData();
      fd.set("race_id", raceId);
      const res = await markRaceNotCompletedPortfolioAction(fd);
      if ("error" in res && res.error) setToast(res.error);
      else router.refresh();
    });
  };

  const runDropBucketBadge = (raceId: string) => {
    startRow(async () => {
      const fd = new FormData();
      fd.set("race_id", raceId);
      const res = await clearBucketListAffiliationAction(fd);
      if ("error" in res && res.error) setToast(res.error);
      else router.refresh();
    });
  };

  const completionModalStrava = useMemo(() => {
    if (!completingGoal) {
      return { candidates: [] as DiscoverStravaActivityCandidate[], manualEligible: undefined as number | undefined };
    }
    const did = completingGoal.discover_race_id?.trim();
    if (did) {
      const discover = getDiscoverRaceById(did);
      const manualEligible = discover
        ? stravaActivities.filter(
            (a) => !usedSet.has(a.strava_id) && isStravaManualLinkPoolActivity(a, discover)
          ).length
        : undefined;
      return {
        candidates: rankStravaActivitiesForDiscoverRace(did, stravaActivities, usedSet, { forManualLink: true }),
        manualEligible
      };
    }
    const stub = discoverStubForBucketManualPick(completingGoal.distance_km);
    const manualEligible = stravaActivities.filter(
      (a) => !usedSet.has(a.strava_id) && isStravaManualLinkPoolActivity(a, stub)
    ).length;
    return {
      candidates: stravaActivitiesToPickListCandidates(stravaActivities, usedSet, {
        goalDistanceKm: completingGoal.distance_km,
        permissive: true
      }),
      manualEligible
    };
  }, [completingGoal, stravaActivities, usedSet]);

  const completingTitle = completingGoal ? getPortfolioRaceLabel(completingGoal) : "";
  const completingLocation = completingGoal?.location?.trim() ?? "";

  const runRemoveCanonical = (goalId: string) => {
    startRow(async () => {
      const fd = new FormData();
      fd.set("goal_id", goalId);
      const res = await removeCanonicalBucketGoalAction(fd);
      if ("error" in res && res.error) setToast(res.error);
      else {
        setToast("Removed");
        router.refresh();
      }
    });
  };

  const runMarkCanonicalComplete = (goalId: string) => {
    startRow(async () => {
      const fd = new FormData();
      fd.set("goal_id", goalId);
      const res = await markCanonicalBucketGoalCompletedAction(fd);
      if ("error" in res && res.error) setToast(res.error);
      else {
        setToast("Finish saved — link Strava anytime.");
        router.refresh();
      }
    });
  };

  const runUndoCanonicalComplete = (goalId: string) => {
    startRow(async () => {
      const fd = new FormData();
      fd.set("goal_id", goalId);
      const res = await undoCanonicalBucketCompletionAction(fd);
      if ("error" in res && res.error) setToast(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="pb-8">
      {toast ? (
        <div
          className="fixed bottom-6 left-1/2 z-[60] max-w-[min(90vw,360px)] -translate-x-1/2 rounded-full border border-white/15 bg-black/95 px-5 py-2.5 text-center text-sm text-white shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      <div className="mb-5 md:mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">Bucket List</h1>
      </div>

      <div
        ref={searchWrapRef}
        className="sticky top-14 z-40 -mx-4 border-b border-white/10 bg-[#060606]/95 px-4 py-3 backdrop-blur-md md:static md:top-0 md:mx-0 md:rounded-xl md:border md:border-white/10 md:bg-black/40 md:py-3 md:backdrop-blur"
      >
        <label className="sr-only" htmlFor="bucket-global-search">
          Search races
        </label>
        <Input
          id="bucket-global-search"
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          placeholder="Search races…"
          autoComplete="off"
          className="h-12 border-white/18 bg-black/50 text-base text-white placeholder:text-white/35 md:h-11 md:text-sm"
        />
        {showSearchPanel ? (
          <div
            className={cn(
              "fixed inset-x-0 bottom-0 top-0 z-50 flex flex-col bg-[#070707] pt-[max(5rem,env(safe-area-inset-top))] md:absolute md:inset-x-0 md:top-[calc(100%+6px)] md:z-50 md:max-h-[min(420px,70vh)] md:rounded-xl md:border md:border-white/12 md:bg-[#0a0a0a] md:pt-0 md:shadow-xl"
            )}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 md:hidden">
              <span className="text-sm font-medium text-white">Results</span>
              <button
                type="button"
                className="text-sm text-accent"
                onClick={() => {
                  setSearchFocused(false);
                  inputRef.current?.blur();
                }}
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-8 md:max-h-[min(400px,65vh)] md:py-2">
              {canSearchLoading && discoverHits.length === 0 && mergedSearchRows.length === 0 ? (
                <ul className="space-y-2 p-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <li key={i} className="flex gap-3 rounded-lg bg-white/[0.04] p-3">
                      <div className="h-14 w-14 shrink-0 animate-pulse rounded-md bg-white/10" />
                      <div className="flex flex-1 flex-col justify-center gap-2">
                        <div className="h-3 w-[55%] animate-pulse rounded bg-white/10" />
                        <div className="h-2 w-[40%] animate-pulse rounded bg-white/10" />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : mergedSearchRows.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">No matches</p>
              ) : (
                <ul className="space-y-1 md:space-y-0">
                  {mergedSearchRows.map((row) => {
                    const k = row.kind === "discover" ? `disc-${row.race.id}` : `can-${row.race.id}`;
                    const title = row.kind === "discover" ? row.race.name : row.race.name;
                    const loc = row.kind === "discover" ? row.race.location : row.race.locationLabel;
                    const dist =
                      row.kind === "discover"
                        ? formatDiscoverDistance(row.race.distance_km, row.race.multi_day)
                        : formatCanonKm(row.race.distanceKm);
                    const thumb =
                      row.kind === "discover" ? (
                        <Image
                          src={discoverImage(row.race)}
                          alt=""
                          width={56}
                          height={56}
                          className="h-14 w-14 rounded-md object-cover"
                        />
                      ) : (
                        <SearchThumb canon={row.race} />
                      );
                    const added =
                      row.kind === "discover"
                        ? discoverGoalIds.has(row.race.id)
                        : canonicalGoalIds.has(row.race.id);
                    return (
                      <li key={k}>
                        <button
                          type="button"
                          disabled={addPending || added}
                          onClick={() => pickSearchRow(row)}
                          className={cn(
                            "flex w-full gap-3 rounded-xl p-3 text-left transition hover:bg-white/[0.06] active:bg-white/[0.08]",
                            added && "opacity-45"
                          )}
                        >
                          {thumb}
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-white">{title}</p>
                            <p className="mt-0.5 text-xs text-muted">
                              {dist} · {loc}
                            </p>
                            {row.kind === "canonical" ? (
                              <span className="mt-1 inline-block rounded bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent">
                                Verified
                              </span>
                            ) : null}
                          </div>
                          <span className="self-center text-sm font-medium text-accent">{added ? "✓" : "＋"}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <section className="mt-10 space-y-4">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">Popular</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {featuredRaces.map((race) => (
            <FeaturedDiscoverCard
              key={race.id}
              race={race}
              added={discoverGoalIds.has(race.id)}
              adding={addPending}
              highlight={highlightKey === `disc-${race.id}`}
              onAdd={() => runAddDiscover(race.id)}
            />
          ))}
        </div>
      </section>

      <section id="your-goals" className="mt-14 scroll-mt-28 space-y-4">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">Your goals</h2>
        {canonicalFuture.length === 0 && futureGoals.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/12 bg-white/[0.03] py-12 text-center text-sm text-muted">
            Search or tap Popular to add a goal
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {canonicalFuture.map((g) => (
              <GoalHeroCard
                key={g.id}
                highlight={highlightKey === `can-${g.canonical_race_id}`}
                imageSrc={canonicalCardImage(g)}
                fallbackScene={getRaceSceneImagePath(g.raceName)}
                name={g.raceName}
                location={g.locationLabel || "—"}
                distanceLabel={formatCanonKm(g.distanceKm)}
                status="future"
                rowPending={rowPending}
                onRemove={() => runRemoveCanonical(g.id)}
                primaryAction={{
                  label: "Link finish",
                  href: `/races/${g.slug}`,
                  variant: "link"
                }}
                secondaryAction={{
                  label: "Record finish",
                  onClick: () => runMarkCanonicalComplete(g.id)
                }}
              />
            ))}
            {futureGoals.map((race) => {
              const label = getPortfolioRaceLabel(race);
              const did = race.discover_race_id?.trim();
              const discoverMeta = did ? catalogRaces.find((r) => r.id === did) : null;
              const img = discoverMeta ? discoverImage(discoverMeta) : getRaceSceneImagePath(label);
              return (
                <GoalHeroCard
                  key={race.id}
                  highlight={did ? highlightKey === `disc-${did}` : false}
                  imageSrc={null}
                  fallbackScene={img}
                  name={label}
                  location={race.location ?? "—"}
                  distanceLabel={
                    race.distance_km != null ? formatDiscoverDistance(race.distance_km, false) : "—"
                  }
                  status="future"
                  rowPending={rowPending}
                  onRemove={() => runDeleteFuture(race.id)}
                  primaryAction={{
                    label: "Link finish",
                    onClick: () => setCompletingGoal(race),
                    variant: "button"
                  }}
                  catalogHref={did ? `/races/${did}` : null}
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-14 space-y-4">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400/90">Completed</h2>
        {canonicalCompleted.length === 0 && completedBucketRaces.length === 0 ? (
          <p className="text-sm text-muted">Nothing yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {canonicalCompleted.map((g) => {
              const unlinked = g.status === "completed_unlinked";
              const month = formatRaceMonth(g.startDate ?? g.completed_at);
              return (
                <GoalHeroCard
                  key={g.id}
                  imageSrc={canonicalCardImage(g)}
                  fallbackScene={getRaceSceneImagePath(g.raceName)}
                  name={g.raceName}
                  location={g.locationLabel || "—"}
                  distanceLabel={formatCanonKm(g.distanceKm)}
                  status="completed"
                  statusHint={unlinked ? "Link Strava" : undefined}
                  rowPending={rowPending}
                  primaryAction={
                    unlinked
                      ? { label: "Link finish", href: "/dashboard", variant: "link" }
                      : g.linked_strava_activity_id
                        ? {
                            label: "Activity",
                            href: `/activities/${g.linked_strava_activity_id}`,
                            variant: "link"
                          }
                        : { label: "Race page", href: `/races/${g.slug}`, variant: "link" }
                  }
                  secondaryAction={
                    unlinked ? { label: "Undo", onClick: () => runUndoCanonicalComplete(g.id) } : undefined
                  }
                  metaLine={month ?? undefined}
                />
              );
            })}
            {completedBucketRaces.map((race) => {
              const label = getPortfolioRaceLabel(race);
              const did = race.discover_race_id?.trim();
              const discoverMeta = did ? catalogRaces.find((r) => r.id === did) : null;
              const img = discoverMeta ? discoverImage(discoverMeta) : getRaceSceneImagePath(label);
              return (
                <GoalHeroCard
                  key={race.id}
                  imageSrc={null}
                  fallbackScene={img}
                  name={label}
                  location={race.location ?? "—"}
                  distanceLabel={
                    race.distance_km != null ? formatDiscoverDistance(race.distance_km, false) : "—"
                  }
                  status="completed"
                  rowPending={rowPending}
                  primaryAction={{
                    label: "Open finish",
                    href: portfolioRaceHref(race),
                    variant: "link"
                  }}
                  secondaryAction={{
                    label: "Undo",
                    onClick: () => runUndoComplete(race.id)
                  }}
                  tertiaryAction={{
                    label: "Remove badge",
                    onClick: () => runDropBucketBadge(race.id)
                  }}
                  metaLine={race.date ?? undefined}
                  catalogHref={did ? `/races/${did}` : null}
                />
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-12 flex flex-wrap justify-center gap-4 border-t border-white/10 pt-8">
        <Link
          href="/races/find"
          className="text-xs font-medium uppercase tracking-wider text-muted underline-offset-4 hover:text-white hover:underline"
        >
          Full library
        </Link>
        <Link
          href="/races/new"
          className="text-xs font-medium uppercase tracking-wider text-muted underline-offset-4 hover:text-white hover:underline"
        >
          Custom goal
        </Link>
      </div>

      <StravaActivityMatchModal
        open={Boolean(completingGoal)}
        onClose={() => setCompletingGoal(null)}
        discoverRaceId={completingGoal?.discover_race_id?.trim() ?? null}
        raceDisplayTitle={completingTitle}
        discoverLocation={completingLocation}
        bucketFutureRaceId={completingGoal?.id ?? null}
        returnTo="/bucket-list"
        stravaCandidates={completionModalStrava.candidates}
        stravaOk={stravaOk}
        stravaOAuthConfigured={stravaOAuthConfigured}
        stravaFeedErrorMessage={stravaFeedErrorMessage}
        stravaSyncedActivityCount={stravaSyncedActivityCount}
        stravaManualEligibleCount={completionModalStrava.manualEligible}
      />

    </div>
  );
}

function SearchThumb({ canon }: { canon: SearchableRaceRow }) {
  const src = canon.heroImageUrl?.trim() || canon.logoUrl?.trim() || canon.fallbackImageUrl?.trim();
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" loading="lazy" />
    );
  }
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-white/10 text-xs font-bold text-white/40">
      {canon.name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function FeaturedDiscoverCard({
  race,
  added,
  adding,
  highlight,
  onAdd
}: {
  race: DiscoverRace;
  added: boolean;
  adding: boolean;
  highlight: boolean;
  onAdd: () => void;
}) {
  const img = discoverImage(race);
  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/10 bg-black shadow-lg transition",
        highlight && "ring-2 ring-accent ring-offset-2 ring-offset-[#060606]"
      )}
    >
      <div className="relative aspect-[4/5] w-full">
        <Image
          src={img}
          alt=""
          fill
          className="object-cover transition duration-500 group-hover:scale-[1.03]"
          sizes="(max-width:640px) 100vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/15" />
        <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
          <span className="mb-2 inline-block rounded-full border border-white/25 bg-black/35 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-white/95 backdrop-blur-sm">
            {formatDiscoverDistance(race.distance_km, race.multi_day)}
          </span>
          <h3 className="mt-2 text-lg font-bold leading-tight text-white md:text-xl">{race.name}</h3>
          <p className="mt-1 text-sm text-white/75">{race.location}</p>
          <Button
            type="button"
            disabled={added || adding}
            onClick={onAdd}
            className="mt-4 w-full border border-white/20 bg-white/10 text-[12px] font-semibold uppercase tracking-wide text-white backdrop-blur hover:bg-white/20"
          >
            {added ? "On your list" : adding ? "…" : "+ Add"}
          </Button>
        </div>
      </div>
    </article>
  );
}

function GoalHeroCard({
  imageSrc,
  fallbackScene,
  name,
  location,
  distanceLabel,
  status,
  statusHint,
  highlight,
  rowPending,
  onRemove,
  primaryAction,
  secondaryAction,
  tertiaryAction,
  metaLine,
  catalogHref
}: {
  imageSrc: string | null;
  fallbackScene: string;
  name: string;
  location: string;
  distanceLabel: string;
  status: "future" | "completed";
  statusHint?: string;
  highlight?: boolean;
  rowPending: boolean;
  onRemove?: () => void;
  primaryAction:
    | { label: string; href: string; variant: "link" }
    | { label: string; onClick: () => void; variant: "button" };
  secondaryAction?: { label: string; onClick: () => void };
  tertiaryAction?: { label: string; onClick: () => void };
  metaLine?: string;
  catalogHref?: string | null;
}) {
  const hero = imageSrc || fallbackScene;
  const isExternal = Boolean(imageSrc && imageSrc.startsWith("http"));
  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/12 bg-[#080808] shadow-md transition",
        highlight && "ring-2 ring-accent/80",
        status === "future" ? "border-amber-500/20" : "border-emerald-500/15"
      )}
    >
      <div className="relative aspect-[16/10] w-full">
        {isExternal ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <Image src={hero} alt="" fill className="object-cover" sizes="(max-width:640px) 100vw, 40vw" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        <span
          className={cn(
            "absolute left-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            status === "future" ? "bg-amber-500/25 text-amber-100" : "bg-emerald-500/25 text-emerald-100"
          )}
        >
          {status === "future" ? "Future" : "Done"}
        </span>
        {statusHint ? (
          <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-gold">
            {statusHint}
          </span>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <span className="inline-block rounded-full border border-white/20 bg-black/40 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">
            {distanceLabel}
          </span>
          <h3 className="mt-2 text-base font-bold text-white md:text-lg">{name}</h3>
          <p className="mt-0.5 text-sm text-white/75">{location}</p>
          {metaLine ? <p className="mt-1 text-xs text-white/50">{metaLine}</p> : null}
        </div>
      </div>
      <div className="flex flex-col gap-2 p-4">
        {primaryAction.variant === "link" ? (
          <Link
            href={primaryAction.href}
            className="inline-flex items-center justify-center rounded-xl bg-accent py-2.5 text-center text-[12px] font-semibold uppercase tracking-wide text-black transition hover:bg-accent/90"
          >
            {primaryAction.label}
          </Link>
        ) : (
          <Button
            type="button"
            className="w-full bg-accent text-black hover:bg-accent/90"
            disabled={rowPending}
            onClick={primaryAction.onClick}
          >
            {primaryAction.label}
          </Button>
        )}
        <div className="flex flex-wrap gap-2">
          {secondaryAction ? (
            <Button type="button" variant="secondary" className="flex-1 text-xs" disabled={rowPending} onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          ) : null}
          {catalogHref ? (
            <Link
              href={catalogHref}
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-white/15 py-2 text-center text-[11px] font-medium text-white/80 hover:border-white/30"
            >
              Race
            </Link>
          ) : null}
          {onRemove ? (
            <Button
              type="button"
              variant="ghost"
              className="text-xs text-red-300 hover:text-red-200"
              disabled={rowPending}
              onClick={onRemove}
            >
              Remove
            </Button>
          ) : null}
          {tertiaryAction ? (
            <Button type="button" variant="ghost" className="text-xs text-muted" disabled={rowPending} onClick={tertiaryAction.onClick}>
              {tertiaryAction.label}
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
