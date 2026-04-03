import { NextResponse } from "next/server";
import { searchCanonicalRacesForFrontend } from "@/lib/races/canonical/search-service";

export const runtime = "nodejs";

function optFiniteNumber(raw: string | null): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Public canonical race search for cards / UI. Only `active` races that meet completeness bar.
 * GET ?query=&country=&city=&trailOnly=&ultraOnly=&distanceMinKm=&distanceMaxKm=&limit=
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query")?.trim() || searchParams.get("q")?.trim() || undefined;
  const country = searchParams.get("country")?.trim() || undefined;
  const city = searchParams.get("city")?.trim() || undefined;
  const trailOnly = searchParams.get("trailOnly") === "true";
  const ultraOnly = searchParams.get("ultraOnly") === "true";
  const distanceMinKm = optFiniteNumber(searchParams.get("distanceMinKm"));
  const distanceMaxKm = optFiniteNumber(searchParams.get("distanceMaxKm"));
  const limit = optFiniteNumber(searchParams.get("limit"));
  const dateFrom = searchParams.get("dateFrom")?.trim() || undefined;
  const dateTo = searchParams.get("dateTo")?.trim() || undefined;

  const res = await searchCanonicalRacesForFrontend({
    query,
    country,
    city,
    dateFrom,
    dateTo,
    trailOnly,
    ultraOnly,
    distanceMinKm,
    distanceMaxKm,
    limit
  });

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 503 });
  }
  return NextResponse.json({ ok: true as const, races: res.races });
}
