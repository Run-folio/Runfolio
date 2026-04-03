import { runfolioLog } from "@/lib/runfolio-log";
import type { RaceIngestSource } from "@/lib/races/types/normalized";

/**
 * Shared helper for providers waiting on real credentials / response contracts.
 * Logs once per call at info level — swap for real fetch when docs are available.
 */
export function logStubProviderCall(
  provider: RaceIngestSource,
  operation: "search" | "getById",
  meta?: Record<string, string>
): void {
  runfolioLog.info(
    `races.provider.${provider}`,
    `Stub ${operation} — TODO: wire live API + map response types`,
    meta
  );
}
