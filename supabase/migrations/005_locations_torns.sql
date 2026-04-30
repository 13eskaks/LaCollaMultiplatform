-- Colla saved locations
CREATE TABLE IF NOT EXISTS colla_llocs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colla_id uuid NOT NULL REFERENCES colles(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  adreca TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_by uuid REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE colla_llocs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "colla_llocs_select" ON colla_llocs;
CREATE POLICY "colla_llocs_select" ON colla_llocs FOR SELECT
  USING (colla_id IN (SELECT colla_id FROM colla_membres WHERE user_id = auth.uid() AND estat = 'actiu'));

DROP POLICY IF EXISTS "colla_llocs_insert" ON colla_llocs;
CREATE POLICY "colla_llocs_insert" ON colla_llocs FOR INSERT
  WITH CHECK (colla_id IN (
    SELECT colla_id FROM colla_membres
    WHERE user_id = auth.uid() AND estat = 'actiu'
    AND rol IN ('president','secretari','tresorer','junta')
  ));

DROP POLICY IF EXISTS "colla_llocs_update" ON colla_llocs;
CREATE POLICY "colla_llocs_update" ON colla_llocs FOR UPDATE
  USING (colla_id IN (
    SELECT colla_id FROM colla_membres
    WHERE user_id = auth.uid() AND estat = 'actiu'
    AND rol IN ('president','secretari','tresorer','junta')
  ));

DROP POLICY IF EXISTS "colla_llocs_delete" ON colla_llocs;
CREATE POLICY "colla_llocs_delete" ON colla_llocs FOR DELETE
  USING (colla_id IN (
    SELECT colla_id FROM colla_membres
    WHERE user_id = auth.uid() AND estat = 'actiu'
    AND rol IN ('president','secretari','tresorer','junta')
  ));

-- Add location fields to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS lloc_lat DOUBLE PRECISION;
ALTER TABLE events ADD COLUMN IF NOT EXISTS lloc_lng DOUBLE PRECISION;
ALTER TABLE events ADD COLUMN IF NOT EXISTS lloc_id uuid REFERENCES colla_llocs(id);

-- Torns rotation config (one per colla)
CREATE TABLE IF NOT EXISTS torns_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colla_id uuid NOT NULL UNIQUE REFERENCES colles(id) ON DELETE CASCADE,
  periodicitat TEXT NOT NULL DEFAULT 'setmanal',
  num_per_torn INTEGER NOT NULL DEFAULT 1,
  data_inici DATE NOT NULL DEFAULT CURRENT_DATE,
  membres_ordre TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE torns_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "torns_config_select" ON torns_config;
CREATE POLICY "torns_config_select" ON torns_config FOR SELECT
  USING (colla_id IN (SELECT colla_id FROM colla_membres WHERE user_id = auth.uid() AND estat = 'actiu'));

DROP POLICY IF EXISTS "torns_config_insert" ON torns_config;
CREATE POLICY "torns_config_insert" ON torns_config FOR INSERT
  WITH CHECK (colla_id IN (
    SELECT colla_id FROM colla_membres
    WHERE user_id = auth.uid() AND estat = 'actiu'
    AND rol IN ('president','secretari','tresorer','junta')
  ));

DROP POLICY IF EXISTS "torns_config_update" ON torns_config;
CREATE POLICY "torns_config_update" ON torns_config FOR UPDATE
  USING (colla_id IN (
    SELECT colla_id FROM colla_membres
    WHERE user_id = auth.uid() AND estat = 'actiu'
    AND rol IN ('president','secretari','tresorer','junta')
  ));

-- Ensure torns_neteja exists with RLS
CREATE TABLE IF NOT EXISTS torns_neteja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colla_id uuid NOT NULL REFERENCES colles(id) ON DELETE CASCADE,
  data_inici DATE NOT NULL,
  data_fi DATE NOT NULL,
  estat TEXT NOT NULL DEFAULT 'pendent',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE torns_neteja ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "torns_neteja_select" ON torns_neteja;
CREATE POLICY "torns_neteja_select" ON torns_neteja FOR SELECT
  USING (colla_id IN (SELECT colla_id FROM colla_membres WHERE user_id = auth.uid() AND estat = 'actiu'));

DROP POLICY IF EXISTS "torns_neteja_all" ON torns_neteja;
CREATE POLICY "torns_neteja_all" ON torns_neteja FOR ALL
  USING (colla_id IN (SELECT colla_id FROM colla_membres WHERE user_id = auth.uid() AND estat = 'actiu'));

-- Ensure torn_membres exists with RLS
CREATE TABLE IF NOT EXISTS torn_membres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  torn_id uuid NOT NULL REFERENCES torns_neteja(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  UNIQUE(torn_id, user_id)
);

ALTER TABLE torn_membres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "torn_membres_select" ON torn_membres;
CREATE POLICY "torn_membres_select" ON torn_membres FOR SELECT
  USING (torn_id IN (
    SELECT id FROM torns_neteja WHERE colla_id IN (
      SELECT colla_id FROM colla_membres WHERE user_id = auth.uid() AND estat = 'actiu'
    )
  ));

DROP POLICY IF EXISTS "torn_membres_all" ON torn_membres;
CREATE POLICY "torn_membres_all" ON torn_membres FOR ALL
  USING (torn_id IN (
    SELECT id FROM torns_neteja WHERE colla_id IN (
      SELECT colla_id FROM colla_membres WHERE user_id = auth.uid() AND estat = 'actiu'
    )
  ));
