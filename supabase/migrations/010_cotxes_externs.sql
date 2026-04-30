-- Multiple cars per user + external/named passengers

-- Give passatgers their own PK and support unnamed guests
ALTER TABLE event_cotxe_passatgers DROP CONSTRAINT event_cotxe_passatgers_pkey;
ALTER TABLE event_cotxe_passatgers
  ADD COLUMN id uuid DEFAULT gen_random_uuid() NOT NULL,
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN nom_extern text;
ALTER TABLE event_cotxe_passatgers ADD PRIMARY KEY (id);

-- An app user can only sit in each car once
CREATE UNIQUE INDEX cotxe_passatger_user_unique
  ON event_cotxe_passatgers(cotxe_id, user_id)
  WHERE user_id IS NOT NULL;

-- Replace old insert/delete policies
DROP POLICY IF EXISTS "passatger pot afegir-se" ON event_cotxe_passatgers;
DROP POLICY IF EXISTS "passatger pot sortir" ON event_cotxe_passatgers;

-- App user adds themselves, OR driver adds an external named passenger to their car
CREATE POLICY "passatger insert"
  ON event_cotxe_passatgers FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR (
      user_id IS NULL AND nom_extern IS NOT NULL AND
      EXISTS (SELECT 1 FROM event_cotxes WHERE id = cotxe_id AND conductor_id = auth.uid())
    )
  );

-- App user removes themselves, OR driver removes anyone from their car
CREATE POLICY "passatger delete"
  ON event_cotxe_passatgers FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM event_cotxes WHERE id = cotxe_id AND conductor_id = auth.uid())
  );
