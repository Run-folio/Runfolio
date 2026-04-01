/** Parse Strava activity ID from a URL or raw numeric string. */
export function parseStravaActivityId(input: string): string | null {
  const t = input.trim();
  const fromUrl = t.match(/strava\.com\/activities\/(\d+)/i);
  if (fromUrl?.[1]) return fromUrl[1];
  if (/^\d+$/.test(t)) return t;
  return null;
}

export function formatStravaMovingTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

export type StravaActivityJson = {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  total_elevation_gain?: number | null;
  start_date: string;
  description?: string | null;
  map?: { summary_polyline?: string | null };
  start_latlng?: [number, number] | null;
};

export async function fetchStravaActivity(activityId: string, accessToken: string): Promise<StravaActivityJson> {
  const res = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    next: { revalidate: 0 }
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const j = JSON.parse(text) as { message?: string };
      detail = j.message ?? text;
    } catch {
      /* keep text */
    }
    throw new Error(detail || `Strava API error ${res.status}`);
  }
  return JSON.parse(text) as StravaActivityJson;
}
