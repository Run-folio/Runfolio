import { NextResponse } from "next/server";
import { importNormalizedRacesBatch } from "@/lib/races/canonical/import-pipeline";
import { verifyIngestRequest } from "@/lib/races/ingest-auth";
import { searchRacesUnified } from "@/lib/races/service";
import type { RaceIngestSource, UnifiedSearchRequest } from "@/lib/races/types/normalized";

export const runtime = "nodejs";

function sanitizeProviders(raw: unknown): RaceIngestSource[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const allowed = new Set<RaceIngestSource>([
    "active",
    "runsignup",
    "chronotrack",
    "utmb_catalog",
    "raceresult",
    "mock",
    "manual"
  ]);
  return raw.filter((x): x is RaceIngestSource => typeof x === "string" && allowed.has(x as RaceIngestSource));
}

/**
 * Run unified provider search, then import all normalized hits into canonical tables.
 * POST body matches `UnifiedSearchRequest`.
 */
export async function POST(req: Request) {
  if (!verifyIngestRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: Partial<UnifiedSearchRequest> = {};
  try {
    body = (await req.json()) as Partial<UnifiedSearchRequest>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const search = await searchRacesUnified({
    query: typeof body.query === "string" ? body.query : undefined,
    country: typeof body.country === "string" ? body.country : undefined,
    city: typeof body.city === "string" ? body.city : undefined,
    dateFrom: typeof body.dateFrom === "string" ? body.dateFrom : undefined,
    dateTo: typeof body.dateTo === "string" ? body.dateTo : undefined,
    trailOnly: body.trailOnly === true,
    ultraOnly: body.ultraOnly === true,
    distanceMinKm: typeof body.distanceMinKm === "number" ? body.distanceMinKm : undefined,
    distanceMaxKm: typeof body.distanceMaxKm === "number" ? body.distanceMaxKm : undefined,
    elevationMinM: typeof body.elevationMinM === "number" ? body.elevationMinM : undefined,
    elevationMaxM: typeof body.elevationMaxM === "number" ? body.elevationMaxM : undefined,
    limitPerProvider: typeof body.limitPerProvider === "number" ? body.limitPerProvider : undefined,
    providers: sanitizeProviders(body.providers)
  });

  const results = await importNormalizedRacesBatch(search.races);
  const summary = results.reduce(
    (acc, r) => {
      if (r.ok) acc[r.action] = (acc[r.action] ?? 0) + 1;
      else acc.failed += 1;
      return acc;
    },
    { created: 0, linked: 0, updated: 0, noop: 0, failed: 0 } as Record<string, number>
  );

  return NextResponse.json({
    ok: true as const,
    providerErrors: search.providerErrors,
    import: { results, summary }
  });
}
