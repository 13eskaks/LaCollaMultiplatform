-- Support external conductors: make conductor_id nullable, add nom_conductor + afegit_per

ALTER TABLE event_cotxes
  ALTER COLUMN conductor_id DROP NOT NULL,
  ADD COLUMN nom_conductor text,
  ADD COLUMN afegit_per uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Backfill: whoever created the car is also the person who added it
UPDATE event_cotxes SET afegit_per = conductor_id WHERE afegit_per IS NULL;

-- Replace old conductor policies
DROP POLICY IF EXISTS "conductor pot afegir cotxe" ON event_cotxes;
DROP POLICY IF EXISTS "conductor pot eliminar cotxe" ON event_cotxes;

-- Any authenticated member of the colla can add a car (for themselves or on behalf of someone)
CREATE POLICY "cotxe insert"
  ON event_cotxes FOR INSERT
  WITH CHECK (
    afegit_per = auth.uid() AND
    EXISTS (
      SELECT 1 FROM events e
      JOIN colla_membres cm ON cm.colla_id = e.colla_id
      WHERE e.id = event_cotxes.event_id AND cm.user_id = auth.uid()
    )
  );

-- The person who added it OR the conductor (if app user) can delete
CREATE POLICY "cotxe delete"
  ON event_cotxes FOR DELETE
  USING (
    afegit_per = auth.uid() OR conductor_id = auth.uid()
  );
