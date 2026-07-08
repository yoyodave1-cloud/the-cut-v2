-- Academy feature: swing uploads, pose analysis, recommendations, progress tracking.
-- user_id is text (anonymous device id today) so a future auth migration can map
-- device ids -> auth uuids without a schema change. Premium gating can be applied
-- per-route in the backend; nothing here assumes a tier.

create table if not exists academy_swing_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  video_url text,
  storage_path text,
  shot_type text not null check (shot_type in ('driving', 'iron', 'bunker', 'chipping', 'putting')),
  angle_type text not null check (angle_type in ('face_on', 'down_the_line')),
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'complete', 'failed')),
  error_message text,
  duration_seconds numeric,
  fps numeric,
  created_at timestamptz not null default now()
);

create index if not exists academy_swing_uploads_user_type_idx
  on academy_swing_uploads (user_id, shot_type, created_at desc);

create table if not exists academy_swing_analysis (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references academy_swing_uploads(id) on delete cascade,
  shot_type text not null check (shot_type in ('driving', 'iron', 'bunker', 'chipping', 'putting')),
  -- Full pose payload: sampled frames with normalized landmarks + per-frame joint angles,
  -- detected keyframes (per-shot-type phases), and summary metrics.
  joint_angle_data jsonb not null default '{}'::jsonb,
  tempo_ratio numeric,
  identified_faults jsonb not null default '[]'::jsonb,
  checkpoint_results jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  -- LLM coaching narration: { summary, tips: [{fault_tag, tip}], model, generated_at }
  coaching jsonb,
  processed_at timestamptz not null default now()
);

create unique index if not exists academy_swing_analysis_upload_idx
  on academy_swing_analysis (upload_id);

create table if not exists academy_swing_recommendations (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references academy_swing_analysis(id) on delete cascade,
  shot_type text not null,
  fault_tag text not null,
  matched_video_id uuid references creator_videos(id) on delete set null,
  creator_id uuid references creators(id) on delete set null,
  reason text,
  rank integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists academy_swing_recommendations_analysis_idx
  on academy_swing_recommendations (analysis_id, rank);

create table if not exists academy_user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  shot_type text not null check (shot_type in ('driving', 'iron', 'bunker', 'chipping', 'putting')),
  metric_name text not null,
  value numeric not null,
  upload_id uuid references academy_swing_uploads(id) on delete set null,
  recorded_at timestamptz not null default now()
);

create index if not exists academy_user_progress_series_idx
  on academy_user_progress (user_id, shot_type, metric_name, recorded_at desc);

-- Backend accesses these via the service role key; no anon policies on purpose.
alter table academy_swing_uploads enable row level security;
alter table academy_swing_analysis enable row level security;
alter table academy_swing_recommendations enable row level security;
alter table academy_user_progress enable row level security;

-- Public-read bucket for uploaded swing videos (served back to the app player).
insert into storage.buckets (id, name, public)
values ('academy-videos', 'academy-videos', true)
on conflict (id) do nothing;
