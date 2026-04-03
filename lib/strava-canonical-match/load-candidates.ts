import { raceRowToDomain, type CanonicalRaceRow } from "@/lib/races/canonical/repository";
import type { CanonicalRace } from "@/lib/races/canonical/types";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runfolioLog } from "@/lib/runfolio-log";

/** Narrow canonical rows by event window before scoring (deterministic, no full-table scan). */
export async function loadCanonicalRacesInDateWindow(centerYmd: string, dayRadius = 10): Promise<CanonicalRace[]> {
  const supabase = createServiceRoleClient();
  if (!supabase) {
    runfolioLog.warn("canonicalMatch.candidates", "no service role");
    return [];
  }
  const mid = new Date(`${centerYmd.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(mid.getTime())) return [];
  const bef = new Date(mid);
  bef.setUTCDate(bef.getUTCDate() - dayRadius);
  const aft = new Date(mid);
  aft.setUTCDate(aft.getUTCDate() + dayRadius);
  const y1 = bef.toISOString().slice(0, 10);
  const y2 = aft.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("canonical_races")
    .select("*")
    .eq("status", "active")
    .gte("completeness_score", 12)
    .not("start_date", "is", null)
    .gte("start_date", y1)
    .lte("start_date", y2)
    .limit(320);

  if (error) {
    runfolioLog.warn("canonicalMatch.loadWindow", error.message);
    return [];
  }
  return ((data ?? []) as CanonicalRaceRow[]).map(raceRowToDomain);
}

/** When the date window is thin, fall back to name token — bound to an edition window around the activity when possible. */
export async function loadCanonicalRacesByNameToken(
  token: string,
  opts?: { centerYmd?: string; editionDayRadius?: number }
): Promise<CanonicalRace[]> {
  const t = token.trim().slice(0, 48);
  if (t.length < 3) return [];
  const supabase = createServiceRoleClient();
  if (!supabase) return [];
  const radius = opts?.editionDayRadius ?? 520;
  const center = opts?.centerYmd?.slice(0, 10);
  let y1: string | null = null;
  let y2: string | null = null;
  if (center && center.length >= 10) {
    const mid = new Date(`${center}T12:00:00Z`);
    if (!Number.isNaN(mid.getTime())) {
      const bef = new Date(mid);
      bef.setUTCDate(bef.getUTCDate() - radius);
      const aft = new Date(mid);
      aft.setUTCDate(aft.getUTCDate() + radius);
      y1 = bef.toISOString().slice(0, 10);
      y2 = aft.toISOString().slice(0, 10);
    }
  }

  let q = supabase
    .from("canonical_races")
    .select("*")
    .eq("status", "active")
    .gte("completeness_score", 12)
    .not("start_date", "is", null)
    .ilike("name", `%${t}%`);
  if (y1 && y2) {
    q = q.gte("start_date", y1).lte("start_date", y2);
  }
  const { data, error } = await q.limit(80);
  if (error) return [];
  return ((data ?? []) as CanonicalRaceRow[]).map(raceRowToDomain);
}
