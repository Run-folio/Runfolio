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
