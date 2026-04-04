import { XMLParser } from "fast-xml-parser";
import { elevationGainMeters, pathDistanceMeters } from "@/lib/activity-file-import/geo";
import { encodeTrackPolyline } from "@/lib/activity-file-import/encode-polyline";
import type { FileParseResult, TrackPoint } from "@/lib/activity-file-import/types";

function asArray<T>(x: T | T[] | undefined | null): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function readNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

function tcxText(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node).trim();
  if (typeof node === "object" && node !== null && "#text" in node) {
    return String((node as { "#text": string })["#text"]).trim();
  }
  return "";
}

export function parseTcxBuffer(buf: Buffer): FileParseResult {
  const warnings: string[] = [];
  let xml: string;
  try {
    xml = buf.toString("utf8");
  } catch {
    return { ok: false, code: "invalid", message: "Could not read file as text." };
  }
  const lower = xml.slice(0, 200).toLowerCase();
  if (!lower.includes("trainingcenterdatabase") && !lower.includes("<tcx")) {
    return { ok: false, code: "invalid", message: "Not a TCX document." };
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
    return { ok: false, code: "parse_error", message: "TCX XML could not be parsed." };
  }

  const root = doc as Record<string, unknown>;
  const tcd =
    (root.TrainingCenterDatabase as Record<string, unknown> | undefined) ||
    (root.trainingcenterdatabase as Record<string, unknown> | undefined);
  if (!tcd) {
    return { ok: false, code: "parse_error", message: "TCX TrainingCenterDatabase missing." };
  }

  const activities = asArray(tcd.Activities ?? tcd.activities);
  const activity = (activities[0] ?? {}) as Record<string, unknown>;
  const laps = asArray(activity.Lap ?? activity.lap);
  const lap0 = (laps[0] ?? {}) as Record<string, unknown>;

  const totalDist =
    readNum(lap0.TotalDistanceMeters ?? lap0.totaldistancemeters) ??
    readNum(lap0.DistanceMeters ?? lap0.distancemeters);
  const totalTime = readNum(lap0.TotalTimeSeconds ?? lap0.totaltimeseconds);

  const allPoints: TrackPoint[] = [];
  for (const lap of laps) {
    const L = lap as Record<string, unknown>;
    const track = (L.Track ?? L.track) as Record<string, unknown> | undefined;
    const tps = asArray(track?.Trackpoint ?? track?.trackpoint);
    for (const tp of tps) {
      const p = tp as Record<string, unknown>;
      const pos = (p.Position ?? p.position) as Record<string, unknown> | undefined;
      const lat = readNum(pos?.LatitudeDegrees ?? pos?.latitudedegrees);
      const lng = readNum(pos?.LongitudeDegrees ?? pos?.longitudedegrees);
      if (lat == null || lng == null) continue;
      const timeStr = tcxText(p.Time ?? p.time);
      const ele = readNum(p.AltitudeMeters ?? p.altitudemeters);
      allPoints.push({
        lat,
        lng,
        ele: ele != null ? ele : null,
        time: timeStr ? new Date(timeStr).toISOString() : null
      });
    }
  }

  if (allPoints.length === 0) {
    return { ok: false, code: "empty", message: "No trackpoints found in this TCX file." };
  }

  const distFromPts = pathDistanceMeters(allPoints);
  const distM = totalDist != null && totalDist > 0 ? totalDist : distFromPts;
  if (totalDist != null && distFromPts > 0 && Math.abs(totalDist - distFromPts) / distFromPts > 0.15) {
    warnings.push("Reported distance and GPS path distance differ — using the more reliable of the two.");
  }

  const withTime = allPoints.filter((p) => p.time);
  const startIso =
    withTime.length > 0
      ? withTime[0]!.time!
      : tcxText(activity.Id ?? activity.id) || new Date().toISOString();

  let movingSec = totalTime != null && totalTime > 0 ? Math.round(totalTime) : 0;
  if (movingSec <= 0 && withTime.length >= 2) {
    const t0 = Date.parse(withTime[0]!.time!);
    const t1 = Date.parse(withTime[withTime.length - 1]!.time!);
    if (Number.isFinite(t0) && Number.isFinite(t1) && t1 > t0) movingSec = Math.round((t1 - t0) / 1000);
  }
  if (movingSec <= 0 && distM > 0) {
    warnings.push("No duration in file — estimated from distance at ~12 km/h.");
    movingSec = Math.max(60, Math.round(distM / 3.33));
  }

  const elevFile = readNum(lap0.TotalAscentMeters ?? lap0.totalascentmeters);
  const elevPts = elevationGainMeters(allPoints);
  const elevationGainM = elevFile != null && elevFile > 0 ? elevFile : elevPts;

  const sportRaw = tcxText(lap0.Intensity ?? lap0.intensity) || "Run";
  const sportType = sportRaw.toLowerCase().includes("bike") ? "Ride" : "Run";

  return {
    ok: true,
    format: "tcx",
    warnings,
    normalized: {
      name: "Imported activity (TCX)",
      startDateIso: new Date(startIso).toISOString(),
      distanceM: distM,
      movingTimeSec: movingSec,
      elapsedTimeSec: movingSec,
      elevationGainM: elevationGainM,
      sportType,
      activityType: sportType === "Ride" ? "Ride" : "Run",
      startLat: allPoints[0]!.lat,
      startLng: allPoints[0]!.lng,
      polyline: encodeTrackPolyline(allPoints),
      description: null,
      trackPointCount: allPoints.length
    }
  };
}
