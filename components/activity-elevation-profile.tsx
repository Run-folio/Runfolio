"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

type Props = {
  profile: { distance_km: number[]; elevation_m: number[] };
  className?: string;
};

export function ActivityElevationProfile({ profile, className }: Props) {
  const { lineD, areaD, minElev, maxElev, maxKm } = useMemo(() => {
    const dist = profile.distance_km;
    const alt = profile.elevation_m;
    if (dist.length < 2 || alt.length < 2 || dist.length !== alt.length) {
      return { lineD: null as string | null, areaD: null as string | null, minElev: 0, maxElev: 0, maxKm: 0 };
    }
    const minElev = Math.min(...alt);
    const maxElev = Math.max(...alt);
    const maxKm = dist[dist.length - 1]! || dist.reduce((a, b) => Math.max(a, b), 0);
    const pad = Math.max((maxElev - minElev) * 0.06, 3);
    const lo = minElev - pad;
    const hi = maxElev + pad;
    const w = 1000;
    const h = 260;
    const points: [number, number][] = dist.map((km, i) => {
      const x = maxKm > 0 ? (km / maxKm) * w : (i / Math.max(dist.length - 1, 1)) * w;
      const y = h - ((alt[i]! - lo) / (hi - lo)) * h;
      return [x, y];
    });
    const [x0, y0] = points[0]!;
    let lineD = `M ${x0} ${y0}`;
    for (let i = 1; i < points.length; i++) {
      lineD += ` L ${points[i]![0]} ${points[i]![1]}`;
    }
    const last = points[points.length - 1]!;
    const areaD = `${lineD} L ${last[0]} ${h} L ${x0} ${h} Z`;
    return { lineD, areaD, minElev, maxElev, maxKm };
  }, [profile]);

  if (!lineD || !areaD) return null;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap justify-between gap-2 text-[11px] tabular-nums text-muted">
        <span>
          Low / high:{" "}
          <span className="text-white/85">
            {Math.round(minElev)} m — {Math.round(maxElev)} m
          </span>
        </span>
        {maxKm > 0 ? (
          <span>
            Distance: <span className="text-white/85">{maxKm.toFixed(2)} km</span>
          </span>
        ) : null}
      </div>
      <svg viewBox="0 0 1000 260" className="h-auto w-full" preserveAspectRatio="none" role="img" aria-label="Elevation profile">
        <defs>
          <linearGradient id="elevFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(212 175 55)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(212 175 55)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#elevFill)" stroke="none" />
        <path d={lineD} fill="none" stroke="rgb(212 175 55)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}
