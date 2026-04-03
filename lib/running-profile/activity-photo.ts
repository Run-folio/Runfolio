/** First HTTP URL from synced Strava `photos` jsonb array (string URLs). */
export function firstPhotoUrlFromSyncedPhotos(photos: unknown): string | null {
  if (!Array.isArray(photos) || photos.length === 0) return null;
  for (const p of photos) {
    if (typeof p === "string" && /^https?:\/\//i.test(p)) return p;
  }
  return null;
}
