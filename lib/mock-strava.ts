import type { Activity } from "@/types";

export function getMockStravaActivities(userId: string): Omit<Activity, "created_at">[] {
  return [
    {
      id: crypto.randomUUID(),
      user_id: userId,
      strava_id: "strava_1001",
      name: "City Half Marathon Effort",
      distance_km: 21.1,
      moving_time: "01:42:16",
      date: "2026-03-16",
      start_lat: 40.7128,
      start_lng: -74.006,
      polyline: null,
      description: "Felt strong through 18k and held on in the final stretch."
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      strava_id: "strava_1002",
      name: "Mountain 10K Race Day",
      distance_km: 10,
      moving_time: "00:49:22",
      date: "2026-02-11",
      start_lat: 39.7392,
      start_lng: -104.9903,
      polyline: null,
      description: "Big climbs, cold air, and a clean descent finish."
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      strava_id: "strava_1003",
      name: "Waterfront Marathon Simulation",
      distance_km: 42.2,
      moving_time: "03:48:40",
      date: "2025-11-08",
      start_lat: 47.6062,
      start_lng: -122.3321,
      polyline: null,
      description: "First complete marathon block test."
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      strava_id: "strava_1004",
      name: "Night 5K Race",
      distance_km: 5,
      moving_time: "00:21:13",
      date: "2025-08-18",
      start_lat: 34.0522,
      start_lng: -118.2437,
      polyline: null,
      description: "Fast opening kilometer and best 5K this season."
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      strava_id: "strava_1005",
      name: "Trail 25K Challenge",
      distance_km: 25,
      moving_time: "02:31:42",
      date: "2025-10-02",
      start_lat: 45.5152,
      start_lng: -122.6784,
      polyline: null,
      description: "Technical trail and steady pace under rain."
    }
  ];
}
