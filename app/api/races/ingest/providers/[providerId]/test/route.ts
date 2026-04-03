import { NextResponse } from "next/server";
import { getRaceProvider } from "@/lib/races/providers/registry";
import type { RaceIngestSource } from "@/lib/races/types/normalized";

export const runtime = "nodejs";

const ALLOWED = new Set<RaceIngestSource>([
  "active",
  "runsignup",
  "chronotrack",
  "utmb_catalog",
  "raceresult",
  "mock",
  "manual"
]);

type RouteCtx = { params: Promise<{ providerId: string }> };

/**
 * Smoke test: returns provider metadata + a small search sample (no auth by default — safe read-only).
 * Stubs return empty sample until API keys and HTTP clients are wired.
 */
export async function GET(_req: Request, ctx: RouteCtx) {
  const { providerId } = await ctx.params;
  if (!ALLOWED.has(providerId as RaceIngestSource)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }
  const p = getRaceProvider(providerId as RaceIngestSource);
  if (!p) {
    return NextResponse.json({ error: "Provider not registered" }, { status: 500 });
  }

  const search = await p.searchRaces({ limitPerProvider: 5, query: "" });
  const sample = search.ok ? search.data : [];

  return NextResponse.json({
    provider: p.id,
    label: p.label,
    configured: p.isConfigured,
    searchOk: search.ok,
    searchError: search.ok ? null : search.error,
    sampleCount: sample.length,
    sample
  });
}
