export type FileFormat = "gpx" | "tcx" | "fit";

export type TrackPoint = {
  lat: number;
  lng: number;
  /** meters */
  ele?: number | null;
  /** ISO timestamp */
  time?: string | null;
};

/** Normalized activity extracted from a file (before DB row). */
export type NormalizedFileActivity = {
  name: string;
  startDateIso: string;
  distanceM: number;
  movingTimeSec: number;
  elapsedTimeSec: number;
  elevationGainM: number | null;
  sportType: string | null;
  activityType: string | null;
  startLat: number | null;
  startLng: number | null;
  polyline: string | null;
  description: string | null;
  trackPointCount: number;
};

export type FileParseSuccess = {
  ok: true;
  format: FileFormat;
  normalized: NormalizedFileActivity;
  warnings: string[];
};

export type FileParseFailure = {
  ok: false;
  code: "invalid" | "unsupported" | "empty" | "parse_error";
  message: string;
};

export type FileParseResult = FileParseSuccess | FileParseFailure;
