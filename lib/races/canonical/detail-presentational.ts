import type { CanonicalRace } from "@/lib/races/canonical/types";

export function formatCanonicalLocation(r: CanonicalRace): string {
  const parts = [r.city, r.region, r.country].filter((x) => Boolean(x?.trim()));
  if (parts.length) return parts.map((x) => x!.trim()).join(", ");
  if (r.venue?.trim()) return r.venue.trim();
  return "";
}

export function formatCanonicalDistanceKm(km: number | null): string {
  if (km == null || Number.isNaN(km)) return "—";
  if (km >= 100) return `${Math.round(km)} km`;
  return `${km % 1 === 0 ? km : km.toFixed(1)} km`;
}

export function formatCanonicalElevation(m: number | null): string {
  if (m == null || Number.isNaN(m) || m <= 0) return "—";
  return `${Math.round(m)} m`;
}

export function raceSurfaceLabel(r: CanonicalRace): string {
  if (r.surfaceType?.trim()) {
    const s = r.surfaceType.trim();
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }
  if (r.isTrail === true) return "Trail";
  if (r.isRoad === true) return "Road";
  if (r.isTrail === false && r.isRoad === false) return "Mixed";
  return "—";
}
