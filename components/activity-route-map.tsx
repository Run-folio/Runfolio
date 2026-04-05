"use client";

import polyline from "@mapbox/polyline";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

type Props = {
  encodedPolyline: string;
  className?: string;
};

export function ActivityRouteMap({ encodedPolyline, className }: Props) {
  const pathD = useMemo(() => {
    const enc = encodedPolyline.trim();
    if (!enc) return null;
    try {
      const coords = polyline.decode(enc);
      if (coords.length < 2) return null;
      let minLat = Infinity;
      let maxLat = -Infinity;
      let minLng = Infinity;
      let maxLng = -Infinity;
      for (const [lat, lng] of coords) {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
      }
      const latSpan = Math.max(maxLat - minLat, 1e-4);
      const lngSpan = Math.max(maxLng - minLng, 1e-4);
      const latPad = latSpan * 0.12;
      const lngPad = lngSpan * 0.12;
      const w = 1000;
      const h = 420;
      const project = (lat: number, lng: number): [number, number] => {
        const x = ((lng - (minLng - lngPad)) / (lngSpan + 2 * lngPad)) * w;
        const y = h - ((lat - (minLat - latPad)) / (latSpan + 2 * latPad)) * h;
        return [x, y];
      };
      const [x0, y0] = project(coords[0]![0], coords[0]![1]);
      let d = `M ${x0} ${y0}`;
      for (let i = 1; i < coords.length; i++) {
        const [x, y] = project(coords[i]![0], coords[i]![1]);
        d += ` L ${x} ${y}`;
      }
      return d;
    } catch {
      return null;
    }
  }, [encodedPolyline]);

  if (!pathD) return null;

  return (
    <div className={cn("w-full text-teal", className)}>
      <svg viewBox="0 0 1000 420" className="h-auto w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Route shape">
        <path
          d={pathD}
          fill="none"
          stroke="currentColor"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.95}
        />
      </svg>
    </div>
  );
}
