import { XMLParser } from "fast-xml-parser";
import { elevationGainMeters, pathDistanceMeters } from "@/lib/activity-file-import/geo";
import { encodeTrackPolyline } from "@/lib/activity-file-import/encode-polyline";
import type { FileParseFailure, FileParseResult, TrackPoint } from "@/lib/activity-file-import/types";

function asArray<T>(x: T | T[] | undefined | null): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function readNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

function parseTrkpts(seg: unknown): TrackPoint[] {
  const s = seg as Record<string, unknown> | undefined;
  const raw = s?.trkpt;
  const pts = asArray(raw);
  const out: TrackPoint[] = [];
  for (const p of pts) {
    const o = p as Record<string, unknown>;
    const lat = readNum(o["@_lat"] ?? o.lat);
    const lng = readNum(o["@_lon"] ?? o.lon ?? o["@_lng"]);
    if (lat == null || lng == null) continue;
    const ele = readNum(o.ele);
    const timeRaw = o.time;
    const time =
      typeof timeRaw === "string"
        ? timeRaw.trim()
        : timeRaw && typeof timeRaw === "object" && "#text" in (timeRaw as object)
          ? String((timeRaw as { "#text": string })["#text"]).trim()
          : typeof timeRaw === "number"
            ? String(timeRaw)
            : null;
    out.push({
      lat,
      lng,
      ele: ele != null ? ele : null,
      time: time && time.length ? new Date(time).toISOString() : null
    });
  }
  return out;
}

export function parseGpxBuffer(buf: Buffer): FileParseResult {
  const warnings: string[] = [];
  let xml: string;
  try {
    xml = buf.toString("utf8");
  } catch {
    return { ok: false, code: "invalid", message: "Could not read file as text." };
  }
  if (!xml.trim().toLowerCase().includes("<gpx")) {
    return { ok: false, code: "invalid", message: "Not a GPX document (missing gpx root)." };
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
    isArray: () => false
  });

  let doc: unknown;
  try {
    doc = parser.parse(xml);
  } catch {
    return { ok: false, code: "parse_error", message: "GPX XML could not be parsed." };
  }

  const gpx = (doc as { gpx?: Record<string, unknown> }).gpx;
  if (!gpx) {
    return { ok: false, code: "parse_error", message: "GPX root element missing." };
  }

  const trks = asArray(gpx.trk);
  const allPoints: TrackPoint[] = [];
  let name = "";
  for (const trk of trks) {
    const t = trk as Record<string, unknown>;
    if (!name && typeof t.name === "string" && t.name.trim()) name = t.name.trim();
    const segs = asArray(t.trkseg);
    for (const seg of segs) {
      allPoints.push(...parseTrkpts(seg));
    }
  }

  if (allPoints.length === 0) {
    return { ok: false, code: "empty", message: "No track points found in this GPX file." };
  }

  const withTime = allPoints.filter((p) => p.time);
  const startIso =
    withTime.length > 0
      ? withTime[0]!.time!
      : (warnings.push("No timestamps on track — using today’s date as placeholder."),
        new Date().toISOString());

  const dist = pathDistanceMeters(allPoints);
  if (dist < 1) warnings.push("Distance is very small — check the track.");

  const t0 = withTime[0]?.time ? Date.parse(withTime[0]!.time!) : NaN;
  const t1 =
    withTime.length > 1 ? Date.parse(withTime[withTime.length - 1]!.time!) : NaN;
  const elapsedSec =
    Number.isFinite(t0) && Number.isFinite(t1) && t1 > t0 ? Math.round((t1 - t0) / 1000) : 0;

  const elev = elevationGainMeters(allPoints);
  const sport = "Run";
  const poly = encodeTrackPolyline(allPoints);

  return {
    ok: true,
    format: "gpx",
    warnings,
    normalized: {
      name: name || "Imported activity (GPX)",
      startDateIso: new Date(startIso).toISOString(),
      distanceM: dist,
      movingTimeSec: elapsedSec > 0 ? elapsedSec : Math.max(0, Math.round(dist / 3)),
      elapsedTimeSec: elapsedSec > 0 ? elapsedSec : Math.max(0, Math.round(dist / 3)),
      elevationGainM: elev,
      sportType: sport,
      activityType: "Run",
      startLat: allPoints[0]!.lat,
      startLng: allPoints[0]!.lng,
      polyline: poly,
      description: null,
      trackPointCount: allPoints.length
    }
  };
}
