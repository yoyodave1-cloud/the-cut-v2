-- UK launch: flag creator videos blocked from playback in GB.
-- Run once in Supabase SQL editor (or via migration runner).

ALTER TABLE creator_videos ADD COLUMN IF NOT EXISTS blocked_in_gb boolean DEFAULT false;
