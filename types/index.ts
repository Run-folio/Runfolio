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
  /** Optional portfolio tags (persist when columns exist / future editor). */
  tag_pb?: boolean;
  tag_career_highlight?: boolean;
  tag_hardest?: boolean;
  /** User marked bucket-list goal completed (distinct from `is_completed` on the row). */
  tag_bucket_list_done?: boolean;
  /** Short line under the title on the activity portfolio page */
  race_subtitle?: string | null;
  reflection_toughest?: string | null;
  reflection_learned?: string | null;
  reflection_mattered?: string | null;
  finish_notes?: string | null;
  /** User-pasted image URLs when Strava gallery is thin */
  manual_photo_urls?: string[] | null;
};

/** Serializable Strava snapshot for `/activities/[id]` (from API or feed fallback). */
export type ActivityPortfolioStravaView = {
  strava_id: string;
  name: string;
  sport_type: string | null;
  type: string | null;
  start_date: string;
  location_label: string;
  distance_km: number;
  moving_time_label: string;
  elapsed_time_label: string | null;
  pace_label: string | null;
  elevation_m: number | null;
  kudos_count: number;
  achievement_count: number;
  description: string | null;
  has_map: boolean;
  strava_url: string;
  /** Strava-hosted photo URLs (detail API often exposes primary only). */
  photo_urls: string[];
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
  /** From Strava activity detail `photos.primary.urls` when present. */
  primary_photo_url?: string | null;
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
  /** When available from Strava (detail API); list feed usually omits. */
  primary_photo_url?: string | null;
};

/** Catalog match hint for a long run — UI only until the user confirms. */
export type CatalogRaceSuggestion = {
  discoverRaceId: string;
  displayTitle: string;
  confidence: RaceMatchConfidence;
  score: number;
  reasons: string[];
  onUserBucketList: boolean;
  /** Incomplete bucket-list row id when `onUserBucketList` is true. */
  userRaceId: string | null;
};

/** Serializable row for medium-confidence match prompts on the profile. */
export type ProfileStravaMediumMatch = {
  stravaId: string;
  activityTitle: string;
  discoverRaceId: string;
  displayTitle: string;
  score: number;
  reasons: string[];
  onUserBucketList: boolean;
  userRaceId: string | null;
  date: string;
  distanceKm: number;
  elevationM: number | null;
  movingTimeLabel: string;
  location: string;
};

/** Strava effort that passes Runfolio race-candidate filters, plus optional catalog hint. */
export type StravaRaceCandidate = StravaFeedActivity & {
  catalogSuggestion: CatalogRaceSuggestion | null;
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

/** Strava list fetch: full raw list plus filtered race candidates (≥21 km, Run / Trail Run / Race). */
export type StravaFeedResult = {
  activities: StravaFeedActivity[];
  raceCandidates: StravaFeedActivity[];
  stats: StravaFeedStats;
  raceCandidateStats: StravaFeedStats;
  ok: boolean;
  errorMessage?: string;
};
