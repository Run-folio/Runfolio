"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FindRaceCardActions } from "@/components/find-race-card-actions";
import { FindRaceExternalCard } from "@/components/find-race-external-card";
import {
  DISCOVER_GROUP_LABEL,
  DISCOVER_GROUP_ORDER,
  formatDiscoverDistance,
  getPublicCatalogRaces,
  matchesDiscoverFilters,
  type DiscoverGroup,
  type DiscoverRace,
  type DistanceFilterId,
  type SurfaceFilterId
} from "@/lib/discover-races";

const PUBLIC_DISCOVER_RACES = getPublicCatalogRaces();
import { catalogDiscoverViewerState } from "@/lib/catalog-discover-user-state";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CanonicalRaceSearchPanel } from "@/components/canonical-race-search-panel";
import { buildFindPageIngestRequest } from "@/lib/races/find-ingest-search";
import type { UnifiedSearchResponse } from "@/lib/races/types/normalized";
import type { Race } from "@/types";

const DISTANCE_OPTIONS: { id: DistanceFilterId; label: string }[] = [
  { id: "any", label: "Any distance" },
  { id: "half", label: "Half & under (≤25 km)" },
  { id: "marathon", label: "Marathon band (~26–50 km)" },
  { id: "ultra", label: "Ultra (50 km – under 100 mi)" },
  { id: "hundred_plus", label: "100 mi+ & multi-stage" }
];

const SURFACE_OPTIONS: { id: SurfaceFilterId; label: string }[] = [
  { id: "any", label: "Any surface" },
  { id: "road", label: "Road" },
  { id: "trail", label: "Trail" },
  { id: "mixed", label: "Mixed" }
];

function surfaceLabel(s: DiscoverRace["surface"]): string {
  if (s === "road") return "Road";
  if (s === "trail") return "Trail";
  return "Mixed";
}

type ExplorerProps = {
  viewer: "guest" | "authed";
  userRaces: Race[] | null;
  /** Canonical race IDs already on Future Goals */
  addedCanonicalRaceIds: string[];
  /** Profile or bucket-list anchor for “Future Goals” jump after add */
  futureGoalsHref?: string;
};

const INGEST_MOCK = process.env.NEXT_PUBLIC_RACES_INGEST_MOCK === "1";

export function FindRacesExplorer({
  viewer,
  userRaces,
  addedCanonicalRaceIds,
  futureGoalsHref
}: ExplorerProps) {
  const [query, setQuery] = useState("");
  const [distance, setDistance] = useState<DistanceFilterId>("any");
  const [surface, setSurface] = useState<SurfaceFilterId>("any");
  const [debounced, setDebounced] = useState({ query, distance, surface });
  const [registry, setRegistry] = useState<UnifiedSearchResponse | null>(null);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced({ query, distance, surface }), 320);
    return () => window.clearTimeout(t);
  }, [query, distance, surface]);

  useEffect(() => {
    const q = debounced.query.trim();
    if (q.length < 2) {
      setRegistry(null);
      setRegistryError(null);
      setRegistryLoading(false);
      return;
    }
    let cancelled = false;
    setRegistryLoading(true);
    setRegistryError(null);
    const body = buildFindPageIngestRequest(debounced.query, debounced.distance, debounced.surface, {
      includeMockProvider: INGEST_MOCK
    });
    void fetch("/api/races/ingest/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
      .then(async (res) => {
        const data = (await res.json()) as UnifiedSearchResponse & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Search failed");
        if (!cancelled) setRegistry(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setRegistryError(e instanceof Error ? e.message : "Registry search failed");
      })
      .finally(() => {
        if (!cancelled) setRegistryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const filtered = useMemo(
    () => PUBLIC_DISCOVER_RACES.filter((r) => matchesDiscoverFilters(r, query, distance, surface)),
    [query, distance, surface]
  );

  const byGroup = useMemo(() => {
    const map = new Map<DiscoverGroup, DiscoverRace[]>();
    for (const g of DISCOVER_GROUP_ORDER) map.set(g, []);
    for (const r of filtered) {
      map.get(r.group)!.push(r);
    }
    return map;
  }, [filtered]);

  const hasAny = filtered.length > 0;

  return (
    <div className="space-y-10">
      <section className="space-y-4 rounded-[14px] border border-amber-500/20 bg-panel/40 p-4 md:p-6">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/90">Verified races</h2>
          <p className="type-meta mt-1 max-w-2xl text-xs">
            Same verified catalog as your bucket list — search here and save goals in one tap.
          </p>
        </div>
        <CanonicalRaceSearchPanel
          viewer={viewer}
          addedCanonicalRaceIds={addedCanonicalRaceIds}
          futureGoalsHref={futureGoalsHref}
          variant="compact"
        />
      </section>

      <div className="grid gap-4 border border-border bg-panel/60 p-5 md:grid-cols-[1fr_auto_auto] md:items-end md:gap-6">
        <div>
          <label htmlFor="find-race-search" className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            Search
          </label>
          <Input
            id="find-race-search"
            className="mt-2 border-white/15 bg-black/40"
            placeholder="Race name or location…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="find-race-distance" className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            Distance
          </label>
          <select
            id="find-race-distance"
            value={distance}
            onChange={(e) => setDistance(e.target.value as DistanceFilterId)}
            className="mt-2 w-full min-w-[200px] rounded-[12px] border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent/40"
          >
            {DISTANCE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id} className="bg-[#1e2029]">
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="find-race-surface" className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            Surface
          </label>
          <select
            id="find-race-surface"
            value={surface}
            onChange={(e) => setSurface(e.target.value as SurfaceFilterId)}
            className="mt-2 w-full min-w-[160px] rounded-[12px] border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent/40"
          >
            {SURFACE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id} className="bg-[#1e2029]">
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="type-meta text-xs">
        {hasAny ? (
          <>
            Showing <span className="text-white">{filtered.length}</span> curated library races
            {query.trim() ? ` for “${query.trim()}”` : ""}. Use{" "}
            <span className="text-white/90">Add to bucket list</span> on a card or open{" "}
            <span className="text-white/90">Details</span> to link Strava.
          </>
        ) : (
          <>
            No races match these filters.{" "}
            <button
              type="button"
              className="text-accent underline-offset-4 hover:underline"
              onClick={() => {
                setQuery("");
                setDistance("any");
                setSurface("any");
              }}
            >
              Clear filters
            </button>
          </>
        )}
      </p>

      {debounced.query.trim().length >= 2 ? (
        <section className="space-y-3 rounded-[14px] border border-white/10 bg-black/25 p-4 md:p-5" aria-busy={registryLoading}>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">From registries</h2>
              <p className="type-meta mt-1 max-w-xl text-xs">
                Live results from RunSignup{INGEST_MOCK ? " and mock data" : ""}, matched to your filters. Add-to-bucket for
                these rows is coming next.
              </p>
            </div>
            {registryLoading ? (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Searching…</span>
            ) : null}
          </div>
          {registryError ? (
            <p className="text-sm text-amber-200/90" role="alert">
              {registryError}
            </p>
          ) : null}
          {registry && registry.providerErrors.length > 0 ? (
            <ul className="text-[11px] text-muted">
              {registry.providerErrors.map((e) => (
                <li key={e.provider}>
                  {e.provider}: {e.message}
                </li>
              ))}
            </ul>
          ) : null}
          {registry && !registryLoading && registry.races.length === 0 && !registryError ? (
            <p className="text-sm text-muted">No registry races matched — try a broader name or clear distance filters.</p>
          ) : null}
          {registry && registry.races.length > 0 ? (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {registry.races.map((race) => (
                <FindRaceExternalCard key={race.id} race={race} />
              ))}
            </ul>
          ) : null}
        </section>
      ) : (
        <p className="type-meta text-[11px] text-muted">
          Tip: type at least two characters to search public registries (RunSignup) alongside the curated library.
        </p>
      )}

      <h2 className="type-section mt-12 border-b border-white/10 pb-3 text-base md:text-lg">Curated library</h2>
      <p className="type-meta mb-8 mt-2 text-xs text-muted">
        Runfolio majors, UTMB World Series, and hand-curated ultras — filter below.
      </p>

      <div className="space-y-16">
        {DISCOVER_GROUP_ORDER.map((group) => {
          const races = byGroup.get(group) ?? [];
          if (races.length === 0) return null;
          return (
            <section key={group}>
              <h2 className="type-section border-b border-white/10 pb-3 text-base md:text-lg">
                {DISCOVER_GROUP_LABEL[group]}
              </h2>
              <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {races.map((race) => {
                  const cardState = catalogDiscoverViewerState(viewer, userRaces, race.id);
                  return (
                    <li
                      key={race.id}
                      className="flex flex-col rounded-lg border border-white/10 bg-[#0d0d0f] p-4 transition hover:border-white/20"
                    >
                      <Link href={`/races/${race.id}`} className="font-semibold text-white hover:text-accent">
                        {race.name}
                      </Link>
                      <p className="type-meta mt-1 text-xs">{race.location}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span
                          className={cn(
                            "border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                            race.surface === "road"
                              ? "border-sky-500/40 bg-sky-500/10 text-sky-200"
                              : race.surface === "trail"
                                ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
                                : "border-violet-500/40 bg-violet-500/10 text-violet-100"
                          )}
                        >
                          {surfaceLabel(race.surface)}
                        </span>
                        <span className="border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                          {formatDiscoverDistance(race.distance_km, race.multi_day)}
                        </span>
                      </div>
                      <FindRaceCardActions discoverId={race.id} state={cardState} />
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
