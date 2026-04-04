/**
 * On-demand SVG “card” when no hero/logo URL is trustworthy.
 * Persist either site-relative path (works for same-origin `<img>`) or absolute URL when `NEXT_PUBLIC_SITE_URL` is set.
 */
export function brandedFallbackCardPath(raceId: string): string {
  return `/api/races/canonical/${raceId}/fallback-image`;
}

export function brandedFallbackCardAbsoluteUrl(raceId: string): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (!raw) return null;
  const base = raw.startsWith("http") ? raw.replace(/\/$/, "") : `https://${raw.replace(/\/$/, "")}`;
  return `${base}${brandedFallbackCardPath(raceId)}`;
}
