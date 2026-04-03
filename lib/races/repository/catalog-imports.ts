import type { NormalizedRace } from "@/lib/races/types/normalized";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runfolioLog } from "@/lib/runfolio-log";

const TABLE = "race_catalog_imports";

export type CatalogImportUpsertResult = { ok: true } | { ok: false; error: string };

/**
 * Persist a normalized race snapshot for caching, enrichment jobs, and debugging.
 * Requires `SUPABASE_SERVICE_ROLE_KEY` and applied migration `migration_race_catalog_imports.sql`.
 */
export async function upsertCatalogImport(race: NormalizedRace): Promise<CatalogImportUpsertResult> {
  const supabase = createServiceRoleClient();
  if (!supabase) {
    return { ok: false, error: "Service role client not configured (SUPABASE_SERVICE_ROLE_KEY)." };
  }

  const now = new Date().toISOString();
  const row = {
    internal_id: race.id,
    source: race.source,
    source_race_id: race.sourceRaceId,
    normalized: race as unknown as Record<string, unknown>,
    raw_payload: race.rawPayload,
    updated_at: now
  };

  const { error } = await supabase.from(TABLE).upsert(row, { onConflict: "internal_id" });
  if (error) {
    runfolioLog.error("races.repository.upsert", error, { internalId: race.id });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function findCatalogImportByInternalId(internalId: string): Promise<NormalizedRace | null> {
  const supabase = createServiceRoleClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .select("normalized")
    .eq("internal_id", internalId)
    .maybeSingle();

  if (error) {
    runfolioLog.warn("races.repository.find", error.message, { internalId });
    return null;
  }
  if (!data?.normalized) return null;
  return data.normalized as NormalizedRace;
}
