/**
 * Bridge Find a Race UI filters → `UnifiedSearchRequest` for `/api/races/ingest/search`.
 * Catalog groups stay client-filtered; this request targets registry providers (RunSignup, mock, …).
 */
import type { DistanceFilterId, SurfaceFilterId } from "@/lib/discover-races";
import type { RaceIngestSource, UnifiedSearchRequest } from "@/lib/races/types/normalized";

export function buildFindPageIngestRequest(
  query: string,
  distance: DistanceFilterId,
  surface: SurfaceFilterId,
  opts?: { includeMockProvider?: boolean }
): UnifiedSearchRequest {
  const req: UnifiedSearchRequest = {
    query: query.trim() || undefined,
    limitPerProvider: 35
  };

  if (surface === "trail") req.trailOnly = true;

  switch (distance) {
    case "half":
      req.distanceMaxKm = 25;
      break;
    case "marathon":
      req.distanceMinKm = 26;
      req.distanceMaxKm = 50;
      break;
    case "ultra":
      req.distanceMinKm = 50;
      req.distanceMaxKm = 160;
      break;
    case "hundred_plus":
      req.distanceMinKm = 161;
      break;
    default:
      break;
  }

  const providers: RaceIngestSource[] = ["runsignup"];
  if (opts?.includeMockProvider) providers.push("mock");
  req.providers = providers;

  return req;
}
