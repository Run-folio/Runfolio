"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { addCanonicalRaceToBucketListAction } from "@/lib/actions";
import type { SearchableRaceRow } from "@/lib/races/canonical/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import Link from "next/link";

type Props = {
  viewer: "guest" | "authed";
  /** Canonical race IDs already on the user’s Future Goals */
  addedCanonicalRaceIds: string[];
  /** Compact layout for embedding (e.g. find page) */
  variant?: "full" | "compact";
  className?: string;
};

function formatDistance(km: number | null): string {
  if (km == null || Number.isNaN(km)) return "—";
  if (km >= 100) return `${Math.round(km)} km`;
  return `${km % 1 === 0 ? km : km.toFixed(1)} km`;
}

function RaceMedia({ race }: { race: SearchableRaceRow }) {
  const src = race.logoUrl?.trim() || race.heroImageUrl?.trim();
  if (src) {
    return (
      <div className="flex h-[88px] w-full items-center justify-center bg-black/45 px-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="max-h-[72px] w-auto max-w-full object-contain" loading="lazy" />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex h-[88px] w-full items-center justify-center bg-gradient-to-br from-[#3d2a1f] via-black to-[#0a1628]",
        "text-[15px] font-semibold tracking-tight text-white/35"
      )}
      aria-hidden
    >
      {race.name.slice(0, 2).toUpperCase()}
    </div>
  );
}

/** Search + filters against `/api/races/canonical/search` (active canonical races only). */
export function CanonicalRaceSearchPanel({ viewer, addedCanonicalRaceIds, variant = "full", className }: Props) {
  const router = useRouter();
  const addedSet = useMemo(() => new Set(addedCanonicalRaceIds), [addedCanonicalRaceIds]);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [trailOnly, setTrailOnly] = useState(false);
  const [ultraOnly, setUltraOnly] = useState(false);
  const [distMin, setDistMin] = useState("");
  const [distMax, setDistMax] = useState("");
  const [debounced, setDebounced] = useState({
    query,
    country,
    dateFrom,
    dateTo,
    trailOnly,
    ultraOnly,
    distMin,
    distMax
  });
  const [races, setRaces] = useState<SearchableRaceRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [addPending, startAdd] = useTransition();

  useEffect(() => {
    const t = window.setTimeout(
      () =>
        setDebounced({
          query,
          country,
          dateFrom,
          dateTo,
          trailOnly,
          ultraOnly,
          distMin,
          distMax
        }),
      380
    );
    return () => window.clearTimeout(t);
  }, [query, country, dateFrom, dateTo, trailOnly, ultraOnly, distMin, distMax]);

  const runSearch = useCallback(async () => {
    const q = debounced.query.trim();
    if (q.length < 2) {
      setRaces(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("query", q);
    params.set("limit", "24");
    if (debounced.country.trim()) params.set("country", debounced.country.trim());
    if (debounced.dateFrom.trim()) params.set("dateFrom", debounced.dateFrom.trim());
    if (debounced.dateTo.trim()) params.set("dateTo", debounced.dateTo.trim());
    if (debounced.trailOnly) params.set("trailOnly", "true");
    if (debounced.ultraOnly) params.set("ultraOnly", "true");
    const dmin = Number(debounced.distMin);
    const dmax = Number(debounced.distMax);
    if (Number.isFinite(dmin)) params.set("distanceMinKm", String(dmin));
    if (Number.isFinite(dmax)) params.set("distanceMaxKm", String(dmax));
    try {
      const res = await fetch(`/api/races/canonical/search?${params.toString()}`);
      const body = (await res.json()) as { ok?: boolean; races?: SearchableRaceRow[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Search failed");
      setRaces(body.races ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setRaces([]);
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  useEffect(() => {
    void runSearch();
  }, [runSearch]);

  const runAdd = (canonicalRaceId: string) => {
    if (viewer !== "authed") return;
    setFeedback(null);
    startAdd(async () => {
      const fd = new FormData();
      fd.set("canonical_race_id", canonicalRaceId);
      const res = await addCanonicalRaceToBucketListAction(fd);
      if ("error" in res && res.error) {
        setFeedback(res.error);
        return;
      }
      if ("already" in res && res.already) {
        setFeedback("Already on your bucket list.");
      } else {
        setFeedback("Added to Future Goals.");
      }
      router.refresh();
    });
  };

  const showFilters = variant === "full";

  return (
    <div className={cn("space-y-4", className)}>
      <div
        className={cn(
          "flex flex-col gap-3",
          showFilters ? "md:flex-row md:items-end md:gap-4" : ""
        )}
      >
        <div className="min-w-0 flex-1">
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setFeedback(null);
            }}
            placeholder="Search by race name or location…"
            className="border-white/15 bg-black/40"
            aria-label="Search races"
          />
        </div>
        {showFilters ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:flex md:flex-wrap md:gap-2">
            <Input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Country"
              className="border-white/15 bg-black/35 text-sm"
            />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border-white/15 bg-black/35 text-sm"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border-white/15 bg-black/35 text-sm"
            />
            <Input
              value={distMin}
              onChange={(e) => setDistMin(e.target.value)}
              placeholder="Min km"
              inputMode="decimal"
              className="border-white/15 bg-black/35 text-sm"
            />
            <Input
              value={distMax}
              onChange={(e) => setDistMax(e.target.value)}
              placeholder="Max km"
              inputMode="decimal"
              className="border-white/15 bg-black/35 text-sm"
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] font-semibold uppercase tracking-wider">
        <label className="flex cursor-pointer items-center gap-2 text-muted">
          <input
            type="checkbox"
            checked={trailOnly}
            onChange={(e) => setTrailOnly(e.target.checked)}
            className="rounded border-white/20 bg-black/40"
          />
          Trail only
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-muted">
          <input
            type="checkbox"
            checked={ultraOnly}
            onChange={(e) => setUltraOnly(e.target.checked)}
            className="rounded border-white/20 bg-black/40"
          />
          Ultra only
        </label>
      </div>

      {viewer === "guest" ? (
        <p className="text-sm text-muted">
          <Link href="/auth/login" className="text-accent underline-offset-4 hover:underline">
            Sign in
          </Link>{" "}
          to add verified races to your bucket list.
        </p>
      ) : null}

      {feedback ? (
        <p className="text-sm text-amber-200/90" role="status">
          {feedback}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-red-300/90" role="alert">
          {error}
        </p>
      ) : null}

      {query.trim().length > 0 && query.trim().length < 2 ? (
        <p className="text-sm text-muted">Type at least two characters to search.</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Searching…</p>
      ) : query.trim().length >= 2 && races && races.length === 0 && !error ? (
        <p className="text-sm text-muted">No races match — try broader dates or distance.</p>
      ) : null}

      {races && races.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {races.map((race) => {
            const onList = addedSet.has(race.id);
            const tags = [...race.categoryTags].slice(0, 4);
            if (race.raceType && !tags.includes(race.raceType)) tags.unshift(race.raceType);
            return (
              <li key={race.id}>
                <Card className="flex h-full flex-col overflow-hidden border-white/12 bg-panelAlt/85">
                  <RaceMedia race={race} />
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <p className="text-[15px] font-semibold leading-snug text-white">{race.name}</p>
                    <p className="text-xs text-muted">
                      {race.locationLabel || "Location TBD"}
                      {race.startDate ? ` · ${race.startDate.slice(0, 10)}` : ""}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDistance(race.distanceKm)}
                      {race.elevationGainM != null && race.elevationGainM > 0
                        ? ` · ${Math.round(race.elevationGainM)} m gain`
                        : ""}
                    </p>
                    {tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {tags.slice(0, 4).map((t) => (
                          <span
                            key={t}
                            className="rounded-full border border-white/12 bg-black/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-auto flex flex-wrap gap-2 pt-2">
                      {viewer === "authed" ? (
                        <Button
                          type="button"
                          disabled={addPending || onList}
                          onClick={() => runAdd(race.id)}
                          className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider"
                        >
                          {onList ? "On bucket list" : addPending ? "Adding…" : "Add to Bucket List"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
