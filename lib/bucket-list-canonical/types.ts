/**
 * Lifecycle for rows in `user_bucket_list_goals`.
 *
 * - `saved` — softer “idea” state (optional; same UX as planned until we split UI).
 * - `planned` — on Future Goals; user intends to run it.
 * - `completed_unlinked` — user marked done; no Strava / portfolio row yet.
 * - `completed_linked` — tied to a real activity / portfolio race (future Strava flow).
 * - `featured_on_profile` — curated highlight (future).
 */
export type BucketListGoalStatus =
  | "saved"
  | "planned"
  | "completed_unlinked"
  | "completed_linked"
  | "featured_on_profile";

export type UserBucketListGoalRow = {
  id: string;
  user_id: string;
  canonical_race_id: string;
  status: BucketListGoalStatus;
  added_at: string;
  completed_at: string | null;
  linked_strava_activity_id: string | null;
  linked_user_race_id: string | null;
  profile_approved_at: string | null;
  notes: string | null;
};

/** Flattened row for UI (server-built). */
export type CanonicalBucketGoalView = UserBucketListGoalRow & {
  raceName: string;
  slug: string;
  locationLabel: string;
  startDate: string | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  raceType: string | null;
  surfaceType: string | null;
  categoryTags: string[];
};
