import polyline from "@mapbox/polyline";
import type { TrackPoint } from "@/lib/activity-file-import/types";
import { simplifyPoints } from "@/lib/activity-file-import/geo";

const MAX_POINTS = 400;

/** Google-encoded polyline (precision 5) for map strip / Strava-compatible storage. */
export function encodeTrackPolyline(points: TrackPoint[]): string | null {
  if (points.length < 2) return null;
  const sp = simplifyPoints(points, MAX_POINTS);
  const pairs: [number, number][] = sp.map((p) => [p.lat, p.lng]);
  return polyline.encode(pairs);
}
