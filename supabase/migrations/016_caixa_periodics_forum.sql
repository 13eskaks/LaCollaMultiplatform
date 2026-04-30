-- ========================
-- 1. CAIXA_PERIODICS
-- ========================
CREATE TABLE IF NOT EXISTS caixa_periodics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colla_id        uuid NOT NULL REFERENCES colles(id) ON DELETE CASCADE,
  autor_id        uuid REFERENCES profiles(id),
  tipus           text NOT NULL CHECK (tipus IN ('ingrés', 'despesa')),
  concepte        text NOT NULL,
  import          numeric(10,2) NOT NULL,
  periodicitat    text NOT NULL CHECK (periodicitat IN ('mensual', 'trimestral', 'anual')),
  proper_pagament date NOT NULL DEFAULT current_date,
  actiu           boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_caixa_periodics_colla ON caixa_periodics(colla_id);

ALTER TABLE caixa_periodics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "caixa_periodics_select" ON caixa_periodics FOR SELECT
  USING (is_membre_actiu(colla_id) OR is_superadmin());

CREATE POLICY "caixa_periodics_insert" ON caixa_periodics FOR INSERT
  WITH CHECK (is_comissio(colla_id) OR is_superadmin());

CREATE POLICY "caixa_periodics_update" ON caixa_periodics FOR UPDATE
  USING (is_comissio(colla_id) OR is_superadmin());

CREATE POLICY "caixa_periodics_delete" ON caixa_periodics FOR DELETE
  USING (is_comissio(colla_id) OR is_superadmin());

-- ========================
-- 2. FORUM IMAGES
-- ========================
ALTER TABLE forum_missatges ADD COLUMN IF NOT EXISTS image_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('forum-imatges', 'forum-imatges', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "forum_imatges_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'forum-imatges' AND auth.uid() IS NOT NULL);

CREATE POLICY "forum_imatges_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'forum-imatges' AND auth.uid() IS NOT NULL);
