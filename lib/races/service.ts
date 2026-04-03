import { dedupeNormalizedRaces } from "@/lib/races/dedupe";
import { parseInternalRaceId } from "@/lib/races/id";
import { getRaceProvider, resolveProviders } from "@/lib/races/providers/registry";
import { findCatalogImportByInternalId } from "@/lib/races/repository/catalog-imports";
import { runfolioLog } from "@/lib/runfolio-log";
import type {
  NormalizedRace,
  ProviderSearchError,
  UnifiedSearchRequest,
  UnifiedSearchResponse
} from "@/lib/races/types/normalized";

/**
 * Query one or many providers, merge, dedupe. One provider failing does not fail the whole call.
 */
export async function searchRacesUnified(req: UnifiedSearchRequest): Promise<UnifiedSearchResponse> {
  const providers = resolveProviders(req.providers);
  const collected: NormalizedRace[] = [];
  const providerErrors: ProviderSearchError[] = [];

  await Promise.all(
    providers.map(async (p) => {
      try {
        const res = await p.searchRaces(req);
        if (res.ok) {
          collected.push(...res.data);
        } else {
          providerErrors.push({ provider: p.id, message: res.error });
        }
      } catch (e) {
        runfolioLog.error("races.service.search", e, { provider: p.id });
        providerErrors.push({
          provider: p.id,
          message: e instanceof Error ? e.message : "Unknown error"
        });
      }
    })
  );

  const deduped = dedupeNormalizedRaces(collected);
  return { ok: true, races: deduped, providerErrors };
}

export async function getNormalizedRaceByInternalId(internalId: string): Promise<NormalizedRace | null> {
  const parsed = parseInternalRaceId(internalId);
  if (!parsed) return null;
  const provider = getRaceProvider(parsed.source);
  if (!provider) return null;
  try {
    const res = await provider.getRaceBySourceId(parsed.sourceRaceId);
    if (!res.ok) return null;
    return res.data;
  } catch (e) {
    runfolioLog.error("races.service.getById", e, { internalId });
    return null;
  }
}

/** Cached import row first (when persistence is enabled), then live provider lookup. */
export async function getNormalizedRaceResolved(internalId: string): Promise<NormalizedRace | null> {
  const cached = await findCatalogImportByInternalId(internalId);
  if (cached) return cached;
  return getNormalizedRaceByInternalId(internalId);
}
