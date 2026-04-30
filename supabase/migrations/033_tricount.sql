-- Tricount: shared expense splitting between colla members

CREATE TABLE IF NOT EXISTS despeses_compartides (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  colla_id    uuid        NOT NULL REFERENCES colles(id) ON DELETE CASCADE,
  titol       text        NOT NULL,
  import      numeric(10,2) NOT NULL CHECK (import > 0),
  pagador_id  uuid        NOT NULL REFERENCES profiles(id),
  categoria   text        NOT NULL DEFAULT 'general',
  data        date        NOT NULL DEFAULT CURRENT_DATE,
  nota        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid        REFERENCES profiles(id)
);

-- Who participates in each expense and with what weight (1 = equal share by default)
CREATE TABLE IF NOT EXISTS despesa_parts (
  despesa_id  uuid          NOT NULL REFERENCES despeses_compartides(id) ON DELETE CASCADE,
  user_id     uuid          NOT NULL REFERENCES profiles(id),
  pes         numeric(8,4)  NOT NULL DEFAULT 1 CHECK (pes > 0),
  PRIMARY KEY (despesa_id, user_id)
);

-- Recorded settlements (marks a debt as paid)
CREATE TABLE IF NOT EXISTS liquidacions_tricount (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  colla_id    uuid        NOT NULL REFERENCES colles(id) ON DELETE CASCADE,
  pagador_id  uuid        NOT NULL REFERENCES profiles(id),
  receptor_id uuid        NOT NULL REFERENCES profiles(id),
  import      numeric(10,2) NOT NULL CHECK (import > 0),
  data        timestamptz NOT NULL DEFAULT now(),
  nota        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS despeses_compartides_colla_data ON despeses_compartides(colla_id, data DESC);
CREATE INDEX IF NOT EXISTS despesa_parts_user ON despesa_parts(user_id);
CREATE INDEX IF NOT EXISTS liquidacions_tricount_colla_data ON liquidacions_tricount(colla_id, data DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE despeses_compartides  ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesa_parts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidacions_tricount ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user an active member of this colla?
CREATE OR REPLACE FUNCTION is_membre_actiu(p_colla_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM colla_membres
    WHERE colla_id = p_colla_id
      AND user_id  = auth.uid()
      AND estat    = 'actiu'
  );
$$;

-- despeses_compartides
CREATE POLICY "select_despeses" ON despeses_compartides FOR SELECT TO authenticated
  USING (is_membre_actiu(colla_id));

CREATE POLICY "insert_despeses" ON despeses_compartides FOR INSERT TO authenticated
  WITH CHECK (is_membre_actiu(colla_id) AND created_by = auth.uid());

CREATE POLICY "delete_despeses" ON despeses_compartides FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- despesa_parts
CREATE POLICY "select_parts" ON despesa_parts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM despeses_compartides dc
      WHERE dc.id = despesa_parts.despesa_id AND is_membre_actiu(dc.colla_id)
    )
  );

CREATE POLICY "insert_parts" ON despesa_parts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM despeses_compartides dc
      WHERE dc.id = despesa_parts.despesa_id AND is_membre_actiu(dc.colla_id)
    )
  );

CREATE POLICY "delete_parts" ON despesa_parts FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM despeses_compartides dc
      WHERE dc.id = despesa_parts.despesa_id AND dc.created_by = auth.uid()
    )
  );

-- liquidacions_tricount
CREATE POLICY "select_liquidacions" ON liquidacions_tricount FOR SELECT TO authenticated
  USING (is_membre_actiu(colla_id));

CREATE POLICY "insert_liquidacions" ON liquidacions_tricount FOR INSERT TO authenticated
  WITH CHECK (is_membre_actiu(colla_id) AND pagador_id = auth.uid());

-- ── Enable tricount in all existing colles ────────────────────────────────────

UPDATE colla_config
SET moduls_actius = array_append(moduls_actius, 'tricount')
WHERE NOT ('tricount' = ANY(moduls_actius));
