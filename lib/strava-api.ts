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

/** Human-readable aggregate duration (e.g. totals). */
export function formatDurationFromSeconds(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export type StravaActivityJson = {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time?: number;
  total_elevation_gain?: number | null;
  start_date: string;
  description?: string | null;
  type?: string | null;
  sport_type?: string | null;
  location_city?: string | null;
  location_country?: string | null;
  average_speed?: number | null;
  kudos_count?: number | null;
  achievement_count?: number | null;
  map?: { summary_polyline?: string | null };
  start_latlng?: [number, number] | null;
  photos?: {
    count?: number;
    primary?: {
      unique_id?: string;
      urls?: Record<string, string> | null;
    } | null;
  } | null;
};

export function pickStravaPrimaryPhotoUrl(raw: { photos?: StravaActivityJson["photos"] }): string | null {
  const urls = raw.photos?.primary?.urls;
  if (!urls) return null;
  return urls["600"] ?? urls["500"] ?? urls["1000"] ?? Object.values(urls).find(Boolean) ?? null;
}

/** Strava activity detail usually exposes one primary with multiple size URLs — not a full multi-photo album. */
export function collectStravaActivityPhotoUrls(photos: StravaActivityJson["photos"] | null | undefined): string[] {
  const urls = photos?.primary?.urls;
  if (!urls) return [];
  const vals = Object.values(urls).filter((u): u is string => Boolean(u && typeof u === "string"));
  return [...new Set(vals)];
}

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

/** Summary object returned by GET /athlete/activities (subset of full activity). */
export type StravaSummaryActivityJson = {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time?: number;
  total_elevation_gain?: number | null;
  type?: string | null;
  sport_type?: string | null;
  start_date: string;
  start_date_local?: string | null;
  location_city?: string | null;
  location_country?: string | null;
  average_speed?: number | null;
  max_speed?: number | null;
  kudos_count?: number | null;
  achievement_count?: number | null;
  map?: { summary_polyline?: string | null };
  photos?: StravaActivityJson["photos"];
  start_latlng?: [number, number] | null;
  /** Present on some API responses; often empty on list endpoint. */
  description?: string | null;
};

export async function fetchStravaAthleteActivities(
  accessToken: string,
  opts?: {
    page?: number;
    perPage?: number;
    /** Unix seconds — activities after this time */
    after?: number;
    /** Unix seconds — activities before this time (walk backward in history) */
    before?: number;
  }
): Promise<StravaSummaryActivityJson[]> {
  const page = opts?.page ?? 1;
  const perPage = Math.min(Math.max(opts?.perPage ?? 50, 1), 100);
  const url = new URL("https://www.strava.com/api/v3/athlete/activities");
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));
  if (opts?.after != null && Number.isFinite(opts.after) && opts.after > 0) {
    url.searchParams.set("after", String(Math.floor(opts.after)));
  }
  if (opts?.before != null && Number.isFinite(opts.before) && opts.before > 0) {
    url.searchParams.set("before", String(Math.floor(opts.before)));
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 0 }
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const j = JSON.parse(text) as { message?: string };
      detail = j.message ?? text;
    } catch {
      /* keep */
    }
    if (res.status === 429) {
      throw new Error("Strava rate limit — wait a few minutes and try again.");
    }
    throw new Error(detail || `Strava list error ${res.status}`);
  }
  return JSON.parse(text) as StravaSummaryActivityJson[];
}
