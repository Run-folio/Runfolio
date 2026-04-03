import { NextResponse } from "next/server";
import { verifyIngestRequest } from "@/lib/races/ingest-auth";
import { setCanonicalRaceStatus } from "@/lib/races/canonical/repository";

export const runtime = "nodejs";

/** POST { raceId: uuid } — set status to `active` (searchable when completeness bar met). */
// TODO: Admin UI for review queues and bulk approve.
export async function POST(req: Request) {
  if (!verifyIngestRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { raceId?: string };
  try {
    body = (await req.json()) as { raceId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const raceId = body.raceId?.trim();
  if (!raceId) {
    return NextResponse.json({ error: "Missing raceId" }, { status: 400 });
  }
  const res = await setCanonicalRaceStatus(raceId, "active");
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true as const, race: res.data });
}
