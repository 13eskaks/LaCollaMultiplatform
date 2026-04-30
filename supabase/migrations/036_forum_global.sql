-- Allow global forum threads (colla_id IS NULL)

-- 1. Make colla_id nullable so global posts can have colla_id = NULL
ALTER TABLE forum_fils ALTER COLUMN colla_id DROP NOT NULL;

-- 2. Fix forum_fils SELECT: also show global threads
DROP POLICY IF EXISTS "forum_fils_select" ON forum_fils;
CREATE POLICY "forum_fils_select" ON forum_fils FOR SELECT
  USING (
    colla_id IS NULL
    OR is_membre_actiu(colla_id)
    OR is_superadmin()
  );

-- 3. Fix forum_fils INSERT: allow global posts for any authenticated user
DROP POLICY IF EXISTS "forum_fils_insert" ON forum_fils;
CREATE POLICY "forum_fils_insert" ON forum_fils FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      colla_id IS NULL
      OR (
        is_membre_actiu(colla_id)
        AND (
          is_comissio(colla_id)
          OR (SELECT qui_pot_crear_fils FROM colla_config WHERE colla_id = forum_fils.colla_id) = 'membres'
        )
      )
    )
  );

-- 4. Fix forum_missatges SELECT: also show messages in global threads
DROP POLICY IF EXISTS "forum_missatges_select" ON forum_missatges;
CREATE POLICY "forum_missatges_select" ON forum_missatges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM forum_fils f
      WHERE f.id = forum_missatges.fil_id
        AND (f.colla_id IS NULL OR is_membre_actiu(f.colla_id))
    )
    OR is_superadmin()
  );

-- 5. Fix forum_missatges INSERT: allow posting to global threads
DROP POLICY IF EXISTS "forum_missatges_insert" ON forum_missatges;
CREATE POLICY "forum_missatges_insert" ON forum_missatges FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM forum_fils f
      WHERE f.id = fil_id
        AND (f.colla_id IS NULL OR is_membre_actiu(f.colla_id))
    )
  );

-- 6. Fix forum_missatges DELETE: handle global threads (is_comissio(null) = false, so only author/superadmin)
DROP POLICY IF EXISTS "forum_missatges_delete" ON forum_missatges;
CREATE POLICY "forum_missatges_delete" ON forum_missatges FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM forum_fils f
      WHERE f.id = fil_id
        AND f.colla_id IS NOT NULL
        AND is_comissio(f.colla_id)
    )
    OR is_superadmin()
  );
