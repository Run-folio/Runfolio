import { NextResponse } from "next/server";
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
 * Unified multi-provider race search. POST JSON body: UnifiedSearchRequest
 * (query, country, city, dateFrom, dateTo, trailOnly, ultraOnly, distance/elevation ranges, providers?, limitPerProvider?).
 */
export async function POST(req: Request) {
  let body: Partial<UnifiedSearchRequest> = {};
  try {
    body = (await req.json()) as Partial<UnifiedSearchRequest>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const providers = sanitizeProviders(body.providers);

  const res = await searchRacesUnified({
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
    providers
  });

  return NextResponse.json(res);
}
