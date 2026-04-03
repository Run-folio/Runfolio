-- Supabase upsert on strava_canonical_match_dismissals runs ON CONFLICT DO UPDATE.
-- RLS previously allowed insert + delete + select only, so upsert updates were blocked.

create policy "strava_canon_dismiss_update_own"
  on strava_canonical_match_dismissals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
