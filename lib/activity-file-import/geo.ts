import type { TrackPoint } from "@/lib/activity-file-import/types";

const EARTH_R_M = 6371000;

export function haversineMeters(a: TrackPoint, b: TrackPoint): number {
  const rlat1 = (a.lat * Math.PI) / 180;
  const rlat2 = (b.lat * Math.PI) / 180;
  const dlat = ((b.lat - a.lat) * Math.PI) / 180;
  const dlng = ((b.lng - a.lng) * Math.PI) / 180;
  const s1 = Math.sin(dlat / 2);
  const s2 = Math.sin(dlng / 2);
  const h = s1 * s1 + Math.cos(rlat1) * Math.cos(rlat2) * s2 * s2;
  return 2 * EARTH_R_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pathDistanceMeters(points: TrackPoint[]): number {
  if (points.length < 2) return 0;
  let d = 0;
  for (let i = 1; i < points.length; i++) d += haversineMeters(points[i - 1]!, points[i]!);
  return d;
}

export function elevationGainMeters(points: TrackPoint[]): number | null {
  let gain = 0;
  let has = false;
  let prev: number | null = null;
  for (const p of points) {
    const e = p.ele;
    if (e == null || !Number.isFinite(e)) continue;
    has = true;
    if (prev != null && e > prev) gain += e - prev;
    prev = e;
  }
  return has ? Math.round(gain) : null;
}

/** Downsample for polyline / perf (keeps first and last). */
export function simplifyPoints(points: TrackPoint[], maxPoints: number): TrackPoint[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const out: TrackPoint[] = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]!);
  const last = points[points.length - 1]!;
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}
