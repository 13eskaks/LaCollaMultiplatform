-- Event custom color
ALTER TABLE events ADD COLUMN IF NOT EXISTS color text;

-- Allow creators to update their own shared expenses
CREATE POLICY "update_despeses" ON despeses_compartides FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (is_membre_actiu(colla_id) AND created_by = auth.uid());
