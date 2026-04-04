import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseActivityFileBuffer, sha256Hex } from "@/lib/activity-file-import";
import { persistImportedFileActivity } from "@/lib/activity-file-import/persist-imported-file-activity";
import type { ActivityIngestSource } from "@/lib/strava-sync/types";

export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024;

function sourceForFormat(format: "gpx" | "tcx" | "fit"): ActivityIngestSource {
  return format === "fit" ? "garmin_file" : "manual_file";
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Sign in to import activities." }, { status: 401 });
  }

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json({ ok: false, error: "Use multipart form data with a file field." }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Could not read upload (try a smaller file)." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Missing file field." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "File too large (max 25 MB)." }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const filename = file.name?.trim() || "activity";

  const parsed = await parseActivityFileBuffer(buf, filename);
  if (!parsed.ok) {
    const status =
      parsed.code === "unsupported" ? 415 : parsed.code === "parse_error" || parsed.code === "invalid" ? 400 : 422;
    return NextResponse.json({ ok: false, error: parsed.message, code: parsed.code }, { status });
  }

  const fileHashHex = sha256Hex(buf);
  const activitySource = sourceForFormat(parsed.format);

  const persisted = await persistImportedFileActivity({
    supabase,
    userId: session.user.id,
    normalized: parsed.normalized,
    activitySource,
    fileHashHex,
    warnings: parsed.warnings
  });

  if (!persisted.ok) {
    if (persisted.code === "duplicate") {
      return NextResponse.json(
        {
          ok: false,
          error: persisted.message,
          code: "duplicate",
          strava_activity_id: undefined
        },
        { status: 409 }
      );
    }
    if (persisted.code === "weak_data") {
      return NextResponse.json({ ok: false, error: persisted.message, code: "weak_data" }, { status: 422 });
    }
    return NextResponse.json({ ok: false, error: persisted.message, code: "db" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    strava_activity_id: persisted.strava_activity_id,
    warnings: parsed.warnings,
    format: parsed.format
  });
}
