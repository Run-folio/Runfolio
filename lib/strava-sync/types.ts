export type ActivityIngestSource = "strava" | "garmin_file" | "manual_file";

export type StravaSyncedActivityRow = {
  id: string;
  user_id: string;
  strava_activity_id: string;
  /** strava (API sync) | garmin_file (.fit) | manual_file (GPX/TCX, etc.) */
  activity_source?: ActivityIngestSource;
  name: string;
  description: string | null;
  distance_m: number | null;
  distance_km: number | null;
  elevation_gain_m: number | null;
  moving_time_sec: number | null;
  elapsed_time_sec: number | null;
  start_date: string;
  timezone: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  polyline: string | null;
  photos: unknown[];
  sport_type: string | null;
  activity_type: string | null;
  kudos_count: number | null;
  achievement_count: number | null;
  potential_race_activity: boolean;
  /** Sub-30 km (etc.) rows kept for manual Strava picker — not shown in auto match hub. */
  manual_link_only?: boolean;
  strava_updated_at: string | null;
  payload_hash: string | null;
  linked_portfolio_race_id: string | null;
  /** `not_race` | `snoozed` — see migration_match_hub.sql */
  match_hub_status?: string | null;
  profile_include?: boolean;
  created_at: string;
  updated_at: string;
};
