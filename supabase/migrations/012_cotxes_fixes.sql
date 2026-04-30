-- Fix 1: store coordinates on cotxe so map link uses exact position
ALTER TABLE event_cotxes
  ADD COLUMN IF NOT EXISTS punt_trobada_lat double precision,
  ADD COLUMN IF NOT EXISTS punt_trobada_lng double precision;

-- Fix 2: allow driver (afegit_per) to add external passengers, not just conductor_id
DROP POLICY IF EXISTS "passatger insert" ON event_cotxe_passatgers;
CREATE POLICY "passatger insert"
  ON event_cotxe_passatgers FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR (
      user_id IS NULL AND nom_extern IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM event_cotxes
        WHERE id = cotxe_id
          AND (conductor_id = auth.uid() OR afegit_per = auth.uid())
      )
    )
  );
