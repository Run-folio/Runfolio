import { NextResponse } from "next/server";
import { getMockStravaActivities } from "@/lib/mock-strava";
import { formatStravaMovingTime, parseStravaActivityId, pickStravaPrimaryPhotoUrl } from "@/lib/strava-api";
import { getStravaTokensFromCookies } from "@/lib/strava-cookies";
import { fetchStravaActivityWithRecovery } from "@/lib/strava-resolve-access";
import type { Activity } from "@/types";

function mapStravaToActivity(
  raw: Awaited<ReturnType<typeof fetchStravaActivityWithRecovery>>["activity"],
  userId: string
): Activity {
  const lat = raw.start_latlng?.[0] ?? null;
  const lng = raw.start_latlng?.[1] ?? null;
  const date = raw.start_date.slice(0, 10);
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    strava_id: String(raw.id),
    name: raw.name,
    distance_km: Math.round((raw.distance / 1000) * 100) / 100,
    moving_time: formatStravaMovingTime(raw.moving_time),
    date,
    start_lat: lat,
    start_lng: lng,
    polyline: raw.map?.summary_polyline ?? null,
    description: raw.description ?? null,
    created_at: new Date().toISOString(),
    elevation_m:
      raw.total_elevation_gain != null && !Number.isNaN(raw.total_elevation_gain)
        ? Math.round(raw.total_elevation_gain)
        : null,
    primary_photo_url: pickStravaPrimaryPhotoUrl(raw)
  };
}

/** List sample activities (demo / no URL import). */
export async function GET() {
  const activities = getMockStravaActivities("demo-user").map((a) => ({
    ...a,
    created_at: new Date().toISOString()
  })) as Activity[];
  return NextResponse.json({ activities });
}

type PostBody = { url?: string; activityId?: string };

export async function POST(req: Request) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawInput = body.activityId ?? body.url ?? "";
  const id = parseStravaActivityId(String(rawInput));
  if (!id) {
    return NextResponse.json(
      { error: "Paste a Strava activity URL (e.g. https://www.strava.com/activities/123456) or a numeric activity ID." },
      { status: 400 }
    );
  }

  const jar = await getStravaTokensFromCookies();
  const hasCookie = Boolean(jar.accessToken || jar.refreshToken);
  const hasEnv = Boolean(process.env.STRAVA_ACCESS_TOKEN?.trim() || process.env.STRAVA_REFRESH_TOKEN?.trim());
  if (!hasCookie && !hasEnv) {
    const sample = getMockStravaActivities("demo-user")[0]!;
    const fallback: Activity = {
      ...sample,
      id: crypto.randomUUID(),
      strava_id: id,
      created_at: new Date().toISOString()
    };
    return NextResponse.json({
      activity: fallback,
      source: "mock" as const,
      warning:
        "Strava is not connected — filled with sample data. Use “Connect Strava” on Add race or set STRAVA_ACCESS_TOKEN in .env.local."
    });
  }

  try {
    const { activity: raw, applyCookieRotation } = await fetchStravaActivityWithRecovery(id);
    const activity = mapStravaToActivity(raw, "import");
    const res = NextResponse.json({ activity, source: "strava" as const });
    applyCookieRotation?.(res);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Strava import failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
