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

export function buildStravaAthleteActivitiesListUrl(opts?: {
  page?: number;
  perPage?: number;
  after?: number;
  before?: number;
}): string {
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
  return url.toString();
}

function parseStravaListErrorBody(text: string): string {
  try {
    const j = JSON.parse(text) as { message?: string };
    return j.message ?? text;
  } catch {
    return text;
  }
}

/** Parse Strava / CDN `Retry-After` (seconds). */
export function parseStravaRetryAfterSeconds(res: Response): number | null {
  const h = res.headers.get("retry-after");
  if (!h?.trim()) return null;
  const n = Number(h.trim());
  if (Number.isFinite(n) && n >= 0) return n;
  return null;
}

/** Headers useful for quota / limit debugging (logging). */
export function stravaRateRelatedHeaders(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    const low = key.toLowerCase();
    if (low.includes("ratelimit") || low === "retry-after" || low === "x-request-id") {
      out[key] = value;
    }
  });
  return out;
}

export type StravaAthleteActivitiesPageResult =
  | {
      ok: true;
      data: StravaSummaryActivityJson[];
      httpStatus: number;
      rateLimitHeaders: Record<string, string>;
    }
  | {
      ok: false;
      httpStatus: number;
      kind: "rate_limit" | "unauthorized" | "error";
      message: string;
      retryAfterSec: number | null;
      rateLimitHeaders: Record<string, string>;
    };

export async function tryFetchStravaAthleteActivitiesPage(
  accessToken: string,
  opts?: {
    page?: number;
    perPage?: number;
    after?: number;
    before?: number;
  }
): Promise<StravaAthleteActivitiesPageResult> {
  const res = await fetch(buildStravaAthleteActivitiesListUrl(opts), {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 0 }
  });
  const text = await res.text();
  const rateLimitHeaders = stravaRateRelatedHeaders(res);
  if (!res.ok) {
    const detail = parseStravaListErrorBody(text) || `Strava list error ${res.status}`;
    const retryAfterSec = parseStravaRetryAfterSeconds(res);
    if (res.status === 429) {
      return {
        ok: false,
        httpStatus: 429,
        kind: "rate_limit",
        message: detail,
        retryAfterSec,
        rateLimitHeaders
      };
    }
    if (res.status === 401) {
      return {
        ok: false,
        httpStatus: 401,
        kind: "unauthorized",
        message: detail,
        retryAfterSec: null,
        rateLimitHeaders
      };
    }
    return {
      ok: false,
      httpStatus: res.status,
      kind: "error",
      message: detail,
      retryAfterSec: null,
      rateLimitHeaders
    };
  }
  try {
    return {
      ok: true,
      data: JSON.parse(text) as StravaSummaryActivityJson[],
      httpStatus: res.status,
      rateLimitHeaders
    };
  } catch {
    return {
      ok: false,
      httpStatus: res.status,
      kind: "error",
      message: "Invalid JSON from Strava activities list.",
      retryAfterSec: null,
      rateLimitHeaders
    };
  }
}

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
  const r = await tryFetchStravaAthleteActivitiesPage(accessToken, opts);
  if (r.ok) return r.data;
  if (r.kind === "rate_limit") {
    throw new Error("Strava rate limit — wait a few minutes and try again.");
  }
  throw new Error(r.message || `Strava list error ${r.httpStatus}`);
}
