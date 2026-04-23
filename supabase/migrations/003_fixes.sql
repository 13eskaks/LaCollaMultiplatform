-- =====================================================
-- LACOLLA · MIGRACIÓ DE CORRECCIONS
-- Alinea l'esquema amb el codi de l'app
-- Executa al Supabase SQL Editor DESPRÉS de 001 i 002
-- =====================================================

-- =====================
-- 1. TORNS NETEJA
-- Renombra setmana_inici/fi → data_inici/fi
-- Canvia fet boolean → estat text
-- =====================

ALTER TABLE torns_neteja RENAME COLUMN setmana_inici TO data_inici;
ALTER TABLE torns_neteja RENAME COLUMN setmana_fi TO data_fi;
ALTER TABLE torns_neteja ADD COLUMN estat text NOT NULL DEFAULT 'pendent'
  CHECK (estat IN ('pendent', 'en_curs', 'fet'));
ALTER TABLE torns_neteja DROP COLUMN IF EXISTS fet;
ALTER TABLE torns_neteja DROP COLUMN IF EXISTS signed_at;

-- =====================
-- 2. COLLA_FOTOS (nova taula)
-- L'app usa 'colla_fotos', l'esquema tenia 'fotos'
-- =====================

CREATE TABLE IF NOT EXISTS colla_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colla_id uuid NOT NULL REFERENCES colles(id) ON DELETE CASCADE,
  autor_id uuid REFERENCES profiles(id),
  url text NOT NULL,
  storage_path text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_colla_fotos_colla_id ON colla_fotos(colla_id);

ALTER TABLE colla_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "colla_fotos_select" ON colla_fotos FOR SELECT
  USING (is_membre_actiu(colla_id) OR is_superadmin());

CREATE POLICY "colla_fotos_insert" ON colla_fotos FOR INSERT
  WITH CHECK (
    autor_id = auth.uid()
    AND is_membre_actiu(colla_id)
  );

CREATE POLICY "colla_fotos_delete" ON colla_fotos FOR DELETE
  USING (autor_id = auth.uid() OR is_comissio(colla_id) OR is_superadmin());

-- =====================
-- 3. QUOTES (reestructuració)
-- L'app espera una quota per usuari amb estat, concepte, data_limit, data_pagament
-- =====================

-- Eliminar estructura antiga
DROP TABLE IF EXISTS quota_pagaments CASCADE;
ALTER TABLE quotes DROP COLUMN IF EXISTS titol;
ALTER TABLE quotes DROP COLUMN IF EXISTS termini;
ALTER TABLE quotes DROP COLUMN IF EXISTS descripcio;

-- Afegir columnes que necessita l'app
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS estat text NOT NULL DEFAULT 'pendent'
  CHECK (estat IN ('pendent', 'pagat'));
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS concepte text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS data_limit date;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS data_pagament timestamptz;

-- L'import ja existia; afegir índex per rendiment
CREATE INDEX IF NOT EXISTS idx_quotes_colla_estat ON quotes(colla_id, estat);
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes(user_id);

-- Afegir política d'actualització (marcar com a pagat) — faltava a 002
CREATE POLICY "quotes_update" ON quotes FOR UPDATE
  USING (is_comissio(colla_id) OR is_superadmin());

CREATE POLICY "quotes_delete" ON quotes FOR DELETE
  USING (is_comissio(colla_id) OR is_superadmin());

-- =====================
-- 4. CAIXA_MOVIMENTS (nova taula)
-- L'app usa 'caixa_moviments'; l'esquema tenia 'despeses' (diferent semàntica)
-- =====================

CREATE TABLE IF NOT EXISTS caixa_moviments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colla_id uuid NOT NULL REFERENCES colles(id) ON DELETE CASCADE,
  autor_id uuid REFERENCES profiles(id),
  tipus text NOT NULL CHECK (tipus IN ('ingrés', 'despesa')),
  concepte text NOT NULL,
  import numeric(10,2) NOT NULL,
  data date NOT NULL DEFAULT current_date,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_caixa_moviments_colla_id ON caixa_moviments(colla_id);

ALTER TABLE caixa_moviments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "caixa_moviments_select" ON caixa_moviments FOR SELECT
  USING (is_membre_actiu(colla_id) OR is_superadmin());

CREATE POLICY "caixa_moviments_insert" ON caixa_moviments FOR INSERT
  WITH CHECK (is_comissio(colla_id) OR is_superadmin());

CREATE POLICY "caixa_moviments_update" ON caixa_moviments FOR UPDATE
  USING (is_comissio(colla_id) OR is_superadmin());

CREATE POLICY "caixa_moviments_delete" ON caixa_moviments FOR DELETE
  USING (is_comissio(colla_id) OR is_superadmin());

-- =====================
-- 5. PRESSUPOST_PARTIDES (nova taula)
-- L'app usa 'pressupost_partides'; l'esquema tenia 'pressupost_categories' (diferent semàntica)
-- =====================

CREATE TABLE IF NOT EXISTS pressupost_partides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colla_id uuid NOT NULL REFERENCES colles(id) ON DELETE CASCADE,
  "any" int NOT NULL,
  categoria text NOT NULL,
  concepte text NOT NULL,
  import_pressupostat numeric(10,2) NOT NULL DEFAULT 0,
  import_executat numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pressupost_partides_colla_any ON pressupost_partides(colla_id, "any");

ALTER TABLE pressupost_partides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pressupost_partides_select" ON pressupost_partides FOR SELECT
  USING (is_membre_actiu(colla_id) OR is_superadmin());

CREATE POLICY "pressupost_partides_insert" ON pressupost_partides FOR INSERT
  WITH CHECK (is_comissio(colla_id) OR is_superadmin());

CREATE POLICY "pressupost_partides_update" ON pressupost_partides FOR UPDATE
  USING (is_comissio(colla_id) OR is_superadmin());

CREATE POLICY "pressupost_partides_delete" ON pressupost_partides FOR DELETE
  USING (is_comissio(colla_id) OR is_superadmin());

-- =====================
-- 6. VOTACIONS — renombrar autor_id → creador_id + corregir enum
-- L'app (votacions/create.tsx) insereix { creador_id: user.id }
-- L'app usa 'opcions' però l'enum tenia 'opcions_multiples'
-- =====================

ALTER TABLE votacions RENAME COLUMN autor_id TO creador_id;

ALTER TYPE votacio_tipus RENAME VALUE 'opcions_multiples' TO 'opcions';

-- Habilitar RLS a votacio_opcions (faltava a 002) i afegir totes les polítiques
ALTER TABLE votacio_opcions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "votacio_opcions_select" ON votacio_opcions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM votacions v
      WHERE v.id = votacio_opcions.votacio_id
        AND is_membre_actiu(v.colla_id)
    )
    OR is_superadmin()
  );

CREATE POLICY "votacio_opcions_insert" ON votacio_opcions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM votacions v
      WHERE v.id = votacio_id AND (v.creador_id = auth.uid() OR is_comissio(v.colla_id))
    )
    OR is_superadmin()
  );

CREATE POLICY "votacio_opcions_delete" ON votacio_opcions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM votacions v
      WHERE v.id = votacio_id AND (v.creador_id = auth.uid() OR is_comissio(v.colla_id))
    )
    OR is_superadmin()
  );

-- =====================
-- 7. ACTES — afegir data_acta
-- =====================

ALTER TABLE actes ADD COLUMN IF NOT EXISTS data_acta date;
UPDATE actes SET data_acta = created_at::date WHERE data_acta IS NULL;

-- =====================
-- 7. FORUM_FILS — renombrar autor_id → creador_id + afegir updated_at
-- L'app (forum/create.tsx) insereix { creador_id: user.id }
-- =====================

ALTER TABLE forum_fils RENAME COLUMN autor_id TO creador_id;
ALTER TABLE forum_fils ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Actualitzar les polítiques RLS que fan referència a autor_id
DROP POLICY IF EXISTS "forum_fils_update" ON forum_fils;
DROP POLICY IF EXISTS "forum_fils_delete" ON forum_fils;

CREATE POLICY "forum_fils_update" ON forum_fils FOR UPDATE
  USING (creador_id = auth.uid() OR is_comissio(colla_id) OR is_superadmin());

CREATE POLICY "forum_fils_delete" ON forum_fils FOR DELETE
  USING (creador_id = auth.uid() OR is_comissio(colla_id) OR is_superadmin());

-- =====================
-- 8. FORUM_MISSATGES — renombrar autor_id → user_id
-- L'app insereix { user_id } i compara m.user_id === userId
-- =====================

ALTER TABLE forum_missatges RENAME COLUMN autor_id TO user_id;

-- Actualitzar totes les polítiques que fan referència a autor_id
DROP POLICY IF EXISTS "forum_missatges_insert" ON forum_missatges;
DROP POLICY IF EXISTS "forum_missatges_update" ON forum_missatges;
DROP POLICY IF EXISTS "forum_missatges_delete" ON forum_missatges;

CREATE POLICY "forum_missatges_insert" ON forum_missatges FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM forum_fils f
      WHERE f.id = fil_id AND is_membre_actiu(f.colla_id)
    )
  );

CREATE POLICY "forum_missatges_update" ON forum_missatges FOR UPDATE
  USING (user_id = auth.uid() OR is_superadmin());

CREATE POLICY "forum_missatges_delete" ON forum_missatges FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM forum_fils f
      WHERE f.id = fil_id AND is_comissio(f.colla_id)
    )
    OR is_superadmin()
  );

-- =====================
-- 9. VOTS — renombrar votacio_vots → vots + afegir _user_id_for_dedup
-- L'edge function votar i l'app llegeixen de 'vots'
-- =====================

ALTER TABLE votacio_vots RENAME TO vots;

-- Afegir columna per deduplicació en vots anònims
ALTER TABLE vots ADD COLUMN IF NOT EXISTS _user_id_for_dedup uuid REFERENCES profiles(id);

-- Índex únic per evitar doble vot (funciona per vots anònims i nominals)
CREATE UNIQUE INDEX IF NOT EXISTS vots_dedup_idx
  ON vots(votacio_id, _user_id_for_dedup)
  WHERE _user_id_for_dedup IS NOT NULL;

-- Actualitzar polítiques RLS (ara la taula es diu 'vots')
DROP POLICY IF EXISTS "votacio_vots_select" ON vots;
DROP POLICY IF EXISTS "votacio_vots_insert" ON vots;

CREATE POLICY "vots_select" ON vots FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      EXISTS (
        SELECT 1 FROM votacions v
        WHERE v.id = vots.votacio_id
          AND v.vots_anonims = false
          AND is_membre_actiu(v.colla_id)
      )
    )
    OR is_superadmin()
  );

CREATE POLICY "vots_insert" ON vots FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- =====================
-- 10. COLLA_CONNEXIONS — afegir RLS (faltava a 002)
-- =====================

ALTER TABLE colla_connexions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "connexions_select" ON colla_connexions FOR SELECT
  USING (
    is_membre_actiu(colla_origen_id)
    OR is_membre_actiu(colla_desti_id)
    OR is_superadmin()
  );

CREATE POLICY "connexions_insert" ON colla_connexions FOR INSERT
  WITH CHECK (is_comissio(colla_origen_id) OR is_superadmin());

CREATE POLICY "connexions_update" ON colla_connexions FOR UPDATE
  USING (
    is_comissio(colla_origen_id)
    OR is_comissio(colla_desti_id)
    OR is_superadmin()
  );

CREATE POLICY "connexions_delete" ON colla_connexions FOR DELETE
  USING (
    is_comissio(colla_origen_id)
    OR is_comissio(colla_desti_id)
    OR is_superadmin()
  );

-- =====================
-- 11. TORN_MEMBRES — afegir FK id per selects (l'app accedeix a m.id)
-- =====================

ALTER TABLE torn_membres ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

-- =====================
-- 12. VOTACIO_COMENTARIS — afegir RLS (faltava a 002)
-- (votacio_opcions ja s'ha configurat a la secció 6)
-- =====================

ALTER TABLE votacio_comentaris ENABLE ROW LEVEL SECURITY;

CREATE POLICY "votacio_comentaris_select" ON votacio_comentaris FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM votacions v
      WHERE v.id = votacio_comentaris.votacio_id AND is_membre_actiu(v.colla_id)
    )
    OR is_superadmin()
  );

CREATE POLICY "votacio_comentaris_insert" ON votacio_comentaris FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM votacions v
      WHERE v.id = votacio_id AND is_membre_actiu(v.colla_id)
    )
  );

CREATE POLICY "votacio_comentaris_delete" ON votacio_comentaris FOR DELETE
  USING (user_id = auth.uid() OR is_superadmin());

-- =====================
-- 13. ÍNDEXOS ADDICIONALS
-- =====================

CREATE INDEX IF NOT EXISTS idx_vots_votacio_id ON vots(votacio_id);
CREATE INDEX IF NOT EXISTS idx_vots_user_id ON vots(user_id);
CREATE INDEX IF NOT EXISTS idx_colla_connexions_origen ON colla_connexions(colla_origen_id);
CREATE INDEX IF NOT EXISTS idx_colla_connexions_desti ON colla_connexions(colla_desti_id);
CREATE INDEX IF NOT EXISTS idx_torns_data_inici ON torns_neteja(colla_id, data_inici);
CREATE INDEX IF NOT EXISTS idx_actes_colla_data ON actes(colla_id, data_acta);
