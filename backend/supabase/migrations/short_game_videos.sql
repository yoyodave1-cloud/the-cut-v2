CREATE TABLE IF NOT EXISTS short_game_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL CHECK (topic IN ('putting', 'chipping', 'bunker', 'pitching')),
  youtube_video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (topic, youtube_video_id)
);

CREATE INDEX IF NOT EXISTS short_game_videos_topic_order_idx
  ON short_game_videos (topic, display_order)
  WHERE active = TRUE;
