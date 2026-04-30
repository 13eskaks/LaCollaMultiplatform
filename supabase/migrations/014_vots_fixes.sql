-- Unique constraint on (votacio_id, user_id) so upsert onConflict works
CREATE UNIQUE INDEX IF NOT EXISTS vots_user_unique
  ON vots(votacio_id, user_id)
  WHERE user_id IS NOT NULL;

-- Allow users to retract their own vote
CREATE POLICY "vots_delete" ON vots FOR DELETE
  USING (user_id = auth.uid());
