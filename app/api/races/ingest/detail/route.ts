import { NextResponse } from "next/server";
import { getNormalizedRaceResolved } from "@/lib/races/service";

export const runtime = "nodejs";

/**
 * GET ?internalId=utmb_catalog:disc-utmb
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const internalId = searchParams.get("internalId")?.trim();
  if (!internalId) {
    return NextResponse.json({ error: "Missing internalId query parameter" }, { status: 400 });
  }

  const race = await getNormalizedRaceResolved(internalId);
  if (!race) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true as const, race });
}
