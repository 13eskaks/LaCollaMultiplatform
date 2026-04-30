-- Allow multi-response voting: one row per (user, option) instead of (user, votacio)
ALTER TABLE votacions ADD COLUMN IF NOT EXISTS multi_resposta boolean DEFAULT false;

-- Replace the per-user unique constraint with a per-user-per-option one
ALTER TABLE vots DROP CONSTRAINT IF EXISTS vots_votacio_user_unique;
CREATE UNIQUE INDEX IF NOT EXISTS vots_user_opcio_unique
  ON vots(votacio_id, user_id, opcio_id)
  WHERE user_id IS NOT NULL;
