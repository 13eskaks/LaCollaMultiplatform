-- Add dynamic groups to torns_config
-- grups: [{membres: ["uid1","uid2"]}, ...] — one entry per rotation group
ALTER TABLE torns_config
  ADD COLUMN IF NOT EXISTS grups jsonb NOT NULL DEFAULT '[]'::jsonb;
