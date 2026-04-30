-- Allow driver to add any colla member as passenger (not just external ones)
DROP POLICY IF EXISTS "passatger insert" ON event_cotxe_passatgers;
DROP POLICY IF EXISTS "passatger pot afegir-se" ON event_cotxe_passatgers;

CREATE POLICY "passatger insert"
  ON event_cotxe_passatgers FOR INSERT
  WITH CHECK (
    -- user adds themselves
    user_id = auth.uid()
    OR
    -- driver adds an external passenger (nom_extern)
    (
      user_id IS NULL AND nom_extern IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM event_cotxes
        WHERE id = cotxe_id
          AND (conductor_id = auth.uid() OR afegit_per = auth.uid())
      )
    )
    OR
    -- driver adds a colla member by user_id
    (
      user_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM event_cotxes
        WHERE id = cotxe_id
          AND (conductor_id = auth.uid() OR afegit_per = auth.uid())
      )
    )
  );
