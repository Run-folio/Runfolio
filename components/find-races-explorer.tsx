"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  DISCOVER_GROUP_LABEL,
  DISCOVER_GROUP_ORDER,
  discoverRaces,
  formatDiscoverDistance,
  matchesDiscoverFilters,
  type DiscoverGroup,
  type DiscoverRace,
  type DistanceFilterId,
  type SurfaceFilterId
} from "@/lib/discover-races";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

export function FindRacesExplorer() {
  const [query, setQuery] = useState("");
  const [distance, setDistance] = useState<DistanceFilterId>("any");
  const [surface, setSurface] = useState<SurfaceFilterId>("any");

  const filtered = useMemo(
    () => discoverRaces.filter((r) => matchesDiscoverFilters(r, query, distance, surface)),
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
            Showing <span className="text-white">{filtered.length}</span> races
            {query.trim() ? ` for “${query.trim()}”` : ""}. Add one to your portfolio from{" "}
            <Link href="/races/new" className="text-accent underline-offset-4 hover:underline">
              Add race
            </Link>
            .
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
                {races.map((race) => (
                  <li
                    key={race.id}
                    className="flex flex-col border border-white/10 bg-[#0d0d0f] p-4 transition hover:border-white/20"
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
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
