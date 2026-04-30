CREATE POLICY "vots_update" ON vots FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
