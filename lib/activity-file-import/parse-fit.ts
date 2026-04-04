import FitParser from "fit-file-parser";

type ParsedFit = Awaited<ReturnType<FitParser["parseAsync"]>>;
type ParsedRecord = NonNullable<ParsedFit["records"]>[number];
type ParsedSession = NonNullable<ParsedFit["sessions"]>[number];
import { elevationGainMeters, pathDistanceMeters } from "@/lib/activity-file-import/geo";
import { encodeTrackPolyline } from "@/lib/activity-file-import/encode-polyline";
import type { FileParseResult, TrackPoint } from "@/lib/activity-file-import/types";

function semicircleMaybeToDeg(v: number | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  if (Math.abs(v) <= 90) return v;
  return v * (180 / Math.pow(2, 31));
}

function fitSportLabels(session: ParsedSession): { sport: string | null; type: string | null } {
  const s = session.sport;
  const sub = session.sub_sport;
  if (s === "running") {
    if (sub === "trail") return { sport: "Trail Run", type: "Trail Run" };
    return { sport: "Run", type: "Run" };
  }
  if (s === "walking" || s === "hiking") return { sport: "Walk", type: s === "hiking" ? "Hike" : "Walk" };
  if (s === "cycling") return { sport: "Ride", type: "Ride" };
  if (typeof s === "string" && s.length) {
    const title = s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return { sport: title, type: title };
  }
  return { sport: null, type: null };
}

function recordToPoint(r: ParsedRecord): TrackPoint | null {
  const lat = semicircleMaybeToDeg(r.position_lat);
  const lng = semicircleMaybeToDeg(r.position_long);
  if (lat == null || lng == null) return null;
  const time = r.timestamp ? new Date(r.timestamp).toISOString() : null;
  const ele = r.altitude != null && Number.isFinite(r.altitude) ? r.altitude : null;
  return { lat, lng, ele, time };
}

export async function parseFitBuffer(buf: Buffer): Promise<FileParseResult> {
  const warnings: string[] = [];
  if (buf.length < 14) {
    return { ok: false, code: "invalid", message: "File too small to be a FIT activity." };
  }

  const fitParser = new FitParser({
    force: true,
    speedUnit: "m/s",
    lengthUnit: "m",
    temperatureUnit: "celsius",
    elapsedRecordField: true,
    mode: "list"
  });

  let data: ParsedFit;
  try {
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    data = await fitParser.parseAsync(ab);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown parse error";
    return { ok: false, code: "parse_error", message: `FIT parse failed: ${msg}` };
  }

  const sessions = data.sessions ?? [];
  const session: ParsedSession | undefined = sessions[0];
  const records = (data.records ?? []) as ParsedRecord[];

  const points: TrackPoint[] = [];
  for (const r of records) {
    const p = recordToPoint(r);
    if (p) points.push(p);
  }

  if (!session && points.length === 0) {
    return { ok: false, code: "empty", message: "No usable session or GPS records in this FIT file." };
  }

  const { sport: sportType, type: activityType } = session ? fitSportLabels(session) : { sport: null, type: null };

  let startDateIso: string;
  if (session?.start_time) {
    startDateIso = new Date(session.start_time).toISOString();
  } else if (points[0]?.time) {
    startDateIso = points[0].time!;
  } else {
    warnings.push("Missing start time — using import time.");
    startDateIso = new Date().toISOString();
  }

  let distanceM = session?.total_distance ?? 0;
  if (typeof distanceM !== "number" || !Number.isFinite(distanceM) || distanceM <= 0) {
    distanceM = pathDistanceMeters(points);
  }
  if (distanceM < 1 && points.length >= 2) {
    distanceM = pathDistanceMeters(points);
  }

  let movingTimeSec = session?.total_timer_time ?? session?.total_elapsed_time ?? 0;
  if (typeof movingTimeSec !== "number" || !Number.isFinite(movingTimeSec) || movingTimeSec <= 0) {
    const timed = points.filter((p) => p.time);
    if (timed.length >= 2) {
      const t0 = Date.parse(timed[0]!.time!);
      const t1 = Date.parse(timed[timed.length - 1]!.time!);
      if (Number.isFinite(t0) && Number.isFinite(t1) && t1 > t0) {
        movingTimeSec = Math.round((t1 - t0) / 1000);
      }
    }
  }
  if (movingTimeSec <= 0 && distanceM > 0) {
    warnings.push("No moving time in FIT — estimated from distance at ~12 km/h.");
    movingTimeSec = Math.max(60, Math.round(distanceM / 3.33));
  }

  const elapsedTimeSec =
    session?.total_elapsed_time != null && Number.isFinite(session.total_elapsed_time) && session.total_elapsed_time > 0
      ? Math.round(session.total_elapsed_time)
      : movingTimeSec;

  let elevationGainM: number | null =
    session?.total_ascent != null && Number.isFinite(session.total_ascent) ? Math.round(session.total_ascent) : null;
  if (elevationGainM == null || elevationGainM <= 0) {
    elevationGainM = elevationGainMeters(points);
  }

  const startLat = session?.start_position_lat != null ? semicircleMaybeToDeg(session.start_position_lat) : points[0]?.lat ?? null;
  const startLng =
    session?.start_position_long != null ? semicircleMaybeToDeg(session.start_position_long) : points[0]?.lng ?? null;

  const polyline = encodeTrackPolyline(points);

  const name =
    sportType && distanceM >= 1000
      ? `Imported ${sportType.toLowerCase()} (${Math.round(distanceM / 100) / 10} km)`
      : "Imported activity (FIT)";

  if (points.length === 0 && distanceM > 0) {
    warnings.push("No GPS track in file — distance and time come from device totals only.");
  }

  return {
    ok: true,
    format: "fit",
    warnings,
    normalized: {
      name,
      startDateIso,
      distanceM: distanceM,
      movingTimeSec: Math.max(0, Math.round(movingTimeSec)),
      elapsedTimeSec: Math.max(0, Math.round(elapsedTimeSec)),
      elevationGainM,
      sportType,
      activityType,
      startLat,
      startLng,
      polyline,
      description: null,
      trackPointCount: points.length
    }
  };
}
