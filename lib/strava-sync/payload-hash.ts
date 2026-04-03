import "server-only";

import { createHash } from "node:crypto";
import type { StravaSummaryActivityJson } from "@/lib/strava-api";

/** Stable hash for incremental sync / change detection. */
export function hashStravaSummaryPayload(raw: StravaSummaryActivityJson): string {
  const slim = {
    id: raw.id,
    name: raw.name,
    distance: raw.distance,
    moving_time: raw.moving_time,
    elapsed_time: raw.elapsed_time,
    start_date: raw.start_date,
    total_elevation_gain: raw.total_elevation_gain,
    sport_type: raw.sport_type,
    type: raw.type,
    description: raw.description
  };
  return createHash("sha256").update(JSON.stringify(slim)).digest("hex");
}
