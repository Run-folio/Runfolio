import type { Race } from "@/types";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

/** Set `RUNFOLIO_OFFLINE_DEMO=1` in `.env.local` to skip live Supabase (static demo only). */
export function isOfflineDemoMode() {
  const v = process.env.RUNFOLIO_OFFLINE_DEMO?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function isSupabaseConfigured() {
  if (isOfflineDemoMode()) return false;
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

export const demoUser = {
  id: "demo-user",
  name: "Alex Thompson",
  email: "alex@runfolio.demo"
};

/**
 * Intentionally empty: completions and bucket state must come from Supabase only.
 * `RUNFOLIO_OFFLINE_DEMO=1` still skips live DB — UI shows empty / aspirational states, not fake finishes.
 */
export const demoRaces: Race[] = [];
