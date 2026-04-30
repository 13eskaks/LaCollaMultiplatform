-- =====================================================
-- LACOLLA · MIGRACIÓ 004
-- RLS fixes per a creació de colles + trigger de perfils
-- Executa al Supabase SQL Editor DESPRÉS de 001, 002 i 003
-- =====================================================

-- =====================
-- 1. COLLES — permetre INSERT a usuaris autenticats
-- =====================

DROP POLICY IF EXISTS "colles_insert" ON "public"."colles";
CREATE POLICY "colles_insert" ON "public"."colles"
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =====================
-- 2. COLLA_MEMBRES — permetre que l'usuari s'insereixi a si mateix
-- =====================

DROP POLICY IF EXISTS "colla_membres_insert" ON "public"."colla_membres";
CREATE POLICY "colla_membres_insert" ON "public"."colla_membres"
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- =====================
-- 3. COLLA_CONFIG — permetre INSERT a usuaris autenticats
-- La lògica d'ordre (membre primer, config després) es garanteix al codi
-- =====================

DROP POLICY IF EXISTS "colla_config_insert" ON "public"."colla_config";
CREATE POLICY "colla_config_insert" ON "public"."colla_config"
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =====================
-- 4. TRIGGER — crear perfil automàticament en registrar-se
-- =====================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom, cognoms)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'nom', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'cognoms'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
