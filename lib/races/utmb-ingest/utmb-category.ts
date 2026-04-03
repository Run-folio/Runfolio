/** UTMB Index–style bucket from primary distance (km). Heuristic — refine per race when official category is known. */
export type UtmbIndexCategory = "20K" | "50K" | "100K" | "100M";

export function inferUtmbIndexCategory(distanceKm: number): UtmbIndexCategory | null {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return null;
  if (distanceKm >= 145) return "100M";
  if (distanceKm >= 75) return "100K";
  if (distanceKm >= 35) return "50K";
  return "20K";
}
