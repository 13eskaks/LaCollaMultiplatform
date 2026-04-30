-- Drop all possible legacy unique constraints on (votacio_id, user_id)
ALTER TABLE vots DROP CONSTRAINT IF EXISTS "votacio_vots_id_user_id_key";
ALTER TABLE vots DROP CONSTRAINT IF EXISTS vots_votacio_user_unique;
DROP INDEX IF EXISTS vots_user_unique;
DROP INDEX IF EXISTS vots_user_opcio_unique;

-- One vote per (user, option) — allows multi-response
CREATE UNIQUE INDEX vots_user_opcio_unique
  ON vots(votacio_id, user_id, opcio_id)
  WHERE user_id IS NOT NULL;
