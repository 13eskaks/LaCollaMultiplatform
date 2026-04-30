-- Drop ALL unique constraints on vots (except PK) and recreate correctly
DO $$
DECLARE r RECORD;
BEGIN
  -- Drop unique constraints (not the PK)
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'vots'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE 'ALTER TABLE vots DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;

  -- Drop unique indexes that are not PK and not the one we want to keep
  FOR r IN
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'vots'
      AND indexname NOT LIKE '%pkey%'
      AND indexname != 'vots_user_opcio_unique'
      AND indexdef LIKE '%UNIQUE%'
  LOOP
    EXECUTE 'DROP INDEX IF EXISTS ' || quote_ident(r.indexname);
  END LOOP;
END $$;

DROP INDEX IF EXISTS vots_user_opcio_unique;
CREATE UNIQUE INDEX vots_user_opcio_unique
  ON vots(votacio_id, user_id, opcio_id)
  WHERE user_id IS NOT NULL;
