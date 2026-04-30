-- Política DELETE per a votacions (faltava)
CREATE POLICY "votacions_delete" ON votacions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM colla_membres
      WHERE colla_id = votacions.colla_id
        AND user_id = auth.uid()
        AND estat = 'actiu'
        AND rol IN ('president','secretari','tresorer','junta')
    )
  );

-- Substituir el partial index per un constraint complet perquè upsert funcioni
DROP INDEX IF EXISTS vots_user_unique;
ALTER TABLE vots
  ADD CONSTRAINT vots_votacio_user_unique UNIQUE (votacio_id, user_id);
