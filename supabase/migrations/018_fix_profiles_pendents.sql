-- =====================================================
-- LACOLLA · MIGRACIÓ 018
-- Fix: la comissió no veia el perfil dels membres pendents
--
-- profiles_select requeria cm2.estat = 'actiu', però els
-- membres pendents tenen estat = 'pendent', així el join
-- no retornava cap dada del seu perfil.
-- =====================================================

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR is_superadmin()
    OR EXISTS (
      SELECT 1 FROM colla_membres cm1
      JOIN colla_membres cm2 ON cm1.colla_id = cm2.colla_id
      WHERE cm1.user_id = auth.uid()
        AND cm2.user_id = profiles.id
        AND cm1.estat = 'actiu'
        AND cm2.estat IN ('actiu', 'pendent')
    )
  );
