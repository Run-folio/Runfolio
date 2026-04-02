export type Race = {
  id: string;
  user_id: string;
  name: string;
  location: string | null;
  date: string | null;
  distance_km: number | null;
  elevation_m: number | null;
  time: string | null;
  description: string | null;
  is_completed: boolean;
  /** Official registration / lottery page for bucket-list goals */
  signup_url?: string | null;
  created_at: string;
  /** Set when a Strava activity is linked after user confirms a known-race match */
  strava_activity_id?: string | null;
  discover_race_id?: string | null;
};

export type RaceMatchConfidence = "high" | "medium" | "low";

export type RaceMatchCandidate = {
  discoverRaceId: string;
  title: string;
  location: string;
  distanceKm: number;
  confidence: RaceMatchConfidence;
  /** 0–1 combined score */
  score: number;
  reasons: string[];
  onUserBucketList: boolean;
  userRaceId: string | null;
};

/** Minimal activity fields for known-race matching (Strava import / feed). */
export type ActivityMatchInput = {
  strava_id: string;
  name: string;
  distance_km: number;
  date: string;
  elevation_m: number | null;
  location_city: string | null;
  location_country: string | null;
  sport_type: string | null;
  type: string | null;
};

export type Activity = {
  id: string;
  user_id: string;
  strava_id: string;
  name: string;
  distance_km: number;
  moving_time: string;
  date: string;
  start_lat: number | null;
  start_lng: number | null;
  polyline: string | null;
  description: string | null;
  created_at: string;
  /** Set when prefilled from Strava (optional in DB). */
  elevation_m?: number | null;
};

/** Normalized Strava activity for UI (list + insights). Serializable for RSC → client. */
export type StravaFeedActivity = {
  strava_id: string;
  name: string;
  start_date: string;
  start_date_local?: string | null;
  distance_m: number;
  distance_km: number;
  moving_time_sec: number;
  moving_time_label: string;
  elapsed_time_sec: number;
  elevation_m: number | null;
  sport_type: string | null;
  type: string | null;
  location_city: string | null;
  location_country: string | null;
  average_speed_mps: number | null;
  max_speed_mps: number | null;
  kudos_count: number;
  achievement_count: number;
  summary_polyline: string | null;
  strava_url: string;
};

export type StravaFeedStats = {
  activityCount: number;
  runCount: number;
  totalDistanceKm: number;
  totalElevationM: number;
  totalMovingTimeSec: number;
  longestActivityKm: number;
  highestElevationM: number;
  /** Top 3 by distance among run-like activities */
  topByDistance: StravaFeedActivity[];
};
