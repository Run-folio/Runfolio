import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const BUCKET = "race-portfolio-photos";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Sign in to upload photos." }, { status: 401 });
  }

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json({ ok: false, error: "Use multipart form data with a file field." }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Could not read upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Missing file field." }, { status: 400 });
  }
  const stravaActivityId = String(form.get("strava_activity_id") ?? "").trim();
  if (!stravaActivityId) {
    return NextResponse.json({ ok: false, error: "Missing strava_activity_id." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "Image too large (max 5 MB)." }, { status: 413 });
  }

  const mime = (file.type || "").toLowerCase().split(";")[0]?.trim() || "";
  const ext = MIME_EXT[mime];
  if (!ext) {
    return NextResponse.json(
      { ok: false, error: "Use JPEG, PNG, WebP, or GIF." },
      { status: 415 }
    );
  }

  const uid = session.user.id;
  const path = `${uid}/${stravaActivityId}/${crypto.randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType: mime,
    upsert: false
  });
  if (upErr) {
    return NextResponse.json(
      { ok: false, error: upErr.message || "Upload failed. Ensure the race-portfolio-photos bucket exists." },
      { status: 502 }
    );
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: pub.publicUrl });
}
