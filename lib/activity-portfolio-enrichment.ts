import type { StravaActivityJson, StravaActivityStreamsKeyed } from "@/lib/strava-api";
import type { ActivityPortfolioStravaEnrichment } from "@/types";

const ELEVATION_PROFILE_MAX_POINTS = 220;

function downsamplePairs(
  distanceM: number[],
  altitudeM: number[],
  maxPoints: number
): { distance_km: number[]; elevation_m: number[] } {
  const n = distanceM.length;
  if (n <= maxPoints) {
    return {
      distance_km: distanceM.map((d) => Math.round((d / 1000) * 1000) / 1000),
      elevation_m: altitudeM.map((a) => Math.round(a * 10) / 10)
    };
  }
  const step = n / maxPoints;
  const distOut: number[] = [];
  const altOut: number[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(n - 1, Math.floor(i * step));
    distOut.push(Math.round((distanceM[idx]! / 1000) * 1000) / 1000);
    altOut.push(Math.round(altitudeM[idx]! * 10) / 10);
  }
  return { distance_km: distOut, elevation_m: altOut };
}

export function buildElevationProfileFromStreams(
  streams: StravaActivityStreamsKeyed | null | undefined
): ActivityPortfolioStravaEnrichment["elevation_profile"] {
  const dist = streams?.distance?.data;
  const alt = streams?.altitude?.data;
  if (!dist?.length || !alt?.length || dist.length !== alt.length) return null;
  return downsamplePairs(dist, alt, ELEVATION_PROFILE_MAX_POINTS);
}

export function buildSplitsFromActivity(
  activity: StravaActivityJson | null | undefined
): ActivityPortfolioStravaEnrichment["splits_metric"] {
  const rows = activity?.splits_metric;
  if (!rows?.length) return null;
  return rows.map((s, i) => ({
    index: s.split ?? i + 1,
    distance_m: s.distance,
    moving_time_sec: s.moving_time,
    elevation_m:
      s.elevation_difference != null && Number.isFinite(s.elevation_difference)
        ? Math.round(s.elevation_difference * 10) / 10
        : undefined
  }));
}

export function buildActivityPortfolioEnrichment(
  activity: StravaActivityJson | null | undefined,
  streams: StravaActivityStreamsKeyed | null | undefined
): ActivityPortfolioStravaEnrichment {
  return {
    elevation_profile: buildElevationProfileFromStreams(streams),
    splits_metric: buildSplitsFromActivity(activity)
  };
}
