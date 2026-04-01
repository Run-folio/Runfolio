import { createClient } from "@/lib/supabase/server";
import { demoRaces, isSupabaseConfigured } from "@/lib/demo-mode";
import { isDynamicServerError } from "next/dist/client/components/hooks-server-context";
import { runfolioLog } from "@/lib/runfolio-log";
import type { Race } from "@/types";

export async function getRaceById(id: string): Promise<Race | null> {
  if (!isSupabaseConfigured()) {
    const found = demoRaces.find((r) => r.id === id);
    return found ? ({ ...found } as Race) : null;
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("races").select("*").eq("id", id).maybeSingle();
    if (error || !data) return null;
    return data as Race;
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    runfolioLog.error("getRaceById", e, { id });
    const found = demoRaces.find((r) => r.id === id);
    return found ? ({ ...found } as Race) : null;
  }
}
