"use client";

import { useState, useTransition } from "react";
import { raceOpsMatchProbeAction } from "@/lib/races/internal/race-ops-actions";

type Props = { raceId: string };

export function RaceOpsMatchProbe({ raceId }: Props) {
  const [pending, start] = useTransition();
  const [out, setOut] = useState<string | null>(null);

  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("race_id", raceId);
        start(async () => {
          const r = await raceOpsMatchProbeAction(fd);
          setOut(JSON.stringify(r, null, 2));
        });
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="text-[10px] uppercase text-muted">Activity name</label>
          <input name="act_name" className="mt-1 w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted">Activity date (YMD)</label>
          <input name="act_date" className="mt-1 w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted">Distance km</label>
          <input name="act_distance_km" className="mt-1 w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted">Elevation m</label>
          <input name="act_elevation_m" className="mt-1 w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted">City</label>
          <input name="act_city" className="mt-1 w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted">Country</label>
          <input name="act_country" className="mt-1 w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm" />
        </div>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-slate-700 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white hover:bg-slate-600 disabled:opacity-50"
      >
        {pending ? "Scoring…" : "Run match probe"}
      </button>
      {out ? (
        <pre className="max-h-64 overflow-auto rounded border border-white/10 bg-black/50 p-3 text-[11px] text-emerald-100/90">
          {out}
        </pre>
      ) : null}
    </form>
  );
}
