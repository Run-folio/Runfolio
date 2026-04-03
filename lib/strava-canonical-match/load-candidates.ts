import { raceRowToDomain, type CanonicalRaceRow } from "@/lib/races/canonical/repository";
import type { CanonicalRace } from "@/lib/races/canonical/types";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runfolioLog } from "@/lib/runfolio-log";

/** Narrow canonical rows by event window before scoring (deterministic, no full-table scan). */
export async function loadCanonicalRacesInDateWindow(centerYmd: string, dayRadius = 14): Promise<CanonicalRace[]> {
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
    .limit(500);

  if (error) {
    runfolioLog.warn("canonicalMatch.loadWindow", error.message);
    return [];
  }
  return ((data ?? []) as CanonicalRaceRow[]).map(raceRowToDomain);
}

/** When the date window is empty (missing Strava date, etc.), fall back to name contains token. */
export async function loadCanonicalRacesByNameToken(token: string): Promise<CanonicalRace[]> {
  const t = token.trim().slice(0, 48);
  if (t.length < 3) return [];
  const supabase = createServiceRoleClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("canonical_races")
    .select("*")
    .eq("status", "active")
    .gte("completeness_score", 12)
    .ilike("name", `%${t}%`)
    .limit(80);
  if (error) return [];
  return ((data ?? []) as CanonicalRaceRow[]).map(raceRowToDomain);
}
