/**
 * RunSignup REST client — https://api.runsignup.com/rest
 * Auth: classic `api_key` + `api_secret` query params, OR `rsu_api_key` + header `X-RSU-API-SECRET`.
 */
import { runfolioLog } from "@/lib/runfolio-log";

const DEFAULT_BASE = "https://api.runsignup.com/rest";

export type RunSignupAuthMode = "classic" | "rsu_header" | "none";

export function getRunSignupAuthMode(): RunSignupAuthMode {
  const rsuKey = process.env.RACES_RUNSIGNUP_RSU_API_KEY?.trim();
  const rsuSecret = process.env.RACES_RUNSIGNUP_RSU_SECRET?.trim();
  if (rsuKey && rsuSecret) return "rsu_header";
  const apiKey = process.env.RACES_RUNSIGNUP_API_KEY?.trim();
  const apiSecret = process.env.RACES_RUNSIGNUP_API_SECRET?.trim();
  if (apiKey && apiSecret) return "classic";
  return "none";
}

function baseUrl(): string {
  return (process.env.RACES_RUNSIGNUP_BASE_URL?.trim() || DEFAULT_BASE).replace(/\/$/, "");
}

export async function runSignupRestGet(
  path: string,
  query: Record<string, string | undefined>
): Promise<{ ok: true; data: unknown } | { ok: false; error: string; status?: number }> {
  const mode = getRunSignupAuthMode();
  if (mode === "none") {
    return { ok: false, error: "RunSignup credentials not configured" };
  }

  const url = new URL(`${baseUrl()}${path.startsWith("/") ? path : `/${path}`}`);
  url.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }

  const headers: Record<string, string> = {};
  if (mode === "rsu_header") {
    url.searchParams.set("rsu_api_key", process.env.RACES_RUNSIGNUP_RSU_API_KEY!.trim());
    headers["X-RSU-API-SECRET"] = process.env.RACES_RUNSIGNUP_RSU_SECRET!.trim();
  } else {
    url.searchParams.set("api_key", process.env.RACES_RUNSIGNUP_API_KEY!.trim());
    url.searchParams.set("api_secret", process.env.RACES_RUNSIGNUP_API_SECRET!.trim());
  }

  try {
    const res = await fetch(url.toString(), {
      headers,
      next: { revalidate: 120 }
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      runfolioLog.warn("races.runsignup.http", `HTTP ${res.status}`, { path, body: text.slice(0, 200) });
      return { ok: false, error: `RunSignup HTTP ${res.status}`, status: res.status };
    }
    const data = (await res.json()) as unknown;
    return { ok: true, data };
  } catch (e) {
    runfolioLog.error("races.runsignup.fetch", e, { path });
    return { ok: false, error: e instanceof Error ? e.message : "RunSignup fetch failed" };
  }
}

/** Extract race array from GET /races JSON (handles single object or array). */
export function unwrapRunSignupRaceList(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== "object") return [];
  const root = data as Record<string, unknown>;
  const races = root.races;
  if (!races || typeof races !== "object") return [];
  const race = (races as Record<string, unknown>).race;
  if (Array.isArray(race)) return race.filter((x) => x && typeof x === "object") as Record<string, unknown>[];
  if (race && typeof race === "object") return [race as Record<string, unknown>];
  return [];
}

/** Extract single race from GET /race/:id JSON */
export function unwrapRunSignupSingleRace(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const race = root.race;
  if (race && typeof race === "object") return race as Record<string, unknown>;
  return root;
}

function firstString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function readAddress(raw: Record<string, unknown>): {
  city: string | null;
  region: string | null;
  country: string | null;
} {
  const addr = raw.address;
  if (addr && typeof addr === "object") {
    const a = addr as Record<string, unknown>;
    return {
      city: firstString(a.city, a.city_name),
      region: firstString(a.state, a.state_code),
      country: firstString(a.country, a.country_code)
    };
  }
  return {
    city: firstString(raw.city),
    region: firstString(raw.state, raw.state_code),
    country: firstString(raw.country, raw.country_code)
  };
}

/** Parse distance in km from event list when present (best-effort). */
function pickDistanceKmFromRace(raw: Record<string, unknown>): number | null {
  const events = raw.events;
  if (!events || typeof events !== "object") return null;
  const ev = (events as Record<string, unknown>).event;
  const list = Array.isArray(ev) ? ev : ev && typeof ev === "object" ? [ev] : [];
  let best: number | null = null;
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const e = item as Record<string, unknown>;
    const dist = e.distance;
    const unit = String(e.distance_units ?? e.unit ?? "K").toUpperCase();
    if (typeof dist === "number" && Number.isFinite(dist)) {
      const km = unit.startsWith("M") && !unit.includes("K") ? dist * 1.60934 : dist;
      best = best == null ? km : Math.max(best, km);
    }
  }
  return best;
}

/**
 * Map a RunSignup race JSON object to fields used by `mapToNormalizedRace`.
 * Field names vary slightly between list vs detail responses — we read defensively.
 */
export function parseRunSignupRaceRecord(raw: Record<string, unknown>): {
  race_id: string;
  name: string;
  url: string | null;
  event_start_time: string | null;
  address: { city?: string; state?: string; country?: string };
  distance_km: number | null;
} {
  const raceId = String(raw.race_id ?? raw.raceId ?? "");
  const name = String(raw.name ?? "Unknown race");
  const url =
    firstString(raw.url, raw.race_url, raw.link, raw.website) ??
    (raceId ? `https://runsignup.com/Race/${raceId}` : null);
  const start =
    firstString(
      raw.next_start_date,
      raw.next_start_datetime,
      raw.last_start_date,
      raw.last_start_datetime,
      raw.start_date
    ) ?? null;
  const { city, region, country } = readAddress(raw);
  const distanceKm = pickDistanceKmFromRace(raw);

  return {
    race_id: raceId,
    name,
    url,
    event_start_time: start,
    address: {
      ...(city ? { city } : {}),
      ...(region ? { state: region } : {}),
      ...(country ? { country } : {})
    },
    distance_km: distanceKm
  };
}
