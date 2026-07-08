-- Hot Right Now: view velocity snapshot columns on creator_videos.
-- Run once in Supabase SQL editor (or via scripts/runCreatorVideosViewVelocityMigration.js).

ALTER TABLE creator_videos ADD COLUMN IF NOT EXISTS view_count_prev bigint;
ALTER TABLE creator_videos ADD COLUMN IF NOT EXISTS view_count_prev_at timestamptz;
