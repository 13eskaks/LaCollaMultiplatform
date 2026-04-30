-- =====================================================
-- LACOLLA · MIGRACIÓ 017
-- Fix: les colles públiques no eren visibles a no-membres
--
-- El problema: la política colles_select_public feia un subquery
-- a colla_config, però colla_config té RLS que només permet
-- lectura als membres actius. Resultat: el check perfil_public=true
-- sempre fallava per a usuaris no membres.
--
-- Solució: una funció SECURITY DEFINER que bypassa el RLS de
-- colla_config per comprovar si una colla és pública.
-- =====================================================

CREATE OR REPLACE FUNCTION is_colla_publica(p_colla_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM colla_config
    WHERE colla_id = p_colla_id AND perfil_public = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "colles_select_public" ON colles;
CREATE POLICY "colles_select_public" ON colles FOR SELECT
  USING (
    (estat = 'activa' AND is_colla_publica(id))
    OR is_membre_actiu(id)
    OR is_superadmin()
  );
