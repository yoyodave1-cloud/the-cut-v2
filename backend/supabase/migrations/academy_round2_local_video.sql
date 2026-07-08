-- Academy round 2: local-first video + hard-delete semantics.
--
-- 1. Raw video is never stored server-side any more: the app keeps the only
--    durable copy on-device; the backend processes uploads transiently. Drop
--    the video columns and purge/remove the storage bucket.
-- 2. Deleting an upload must remove it from all long-term stats: progress
--    rows now cascade instead of nulling their upload_id.

alter table academy_swing_uploads drop column if exists video_url;
alter table academy_swing_uploads drop column if exists storage_path;

alter table academy_user_progress
  drop constraint if exists academy_user_progress_upload_id_fkey;
alter table academy_user_progress
  add constraint academy_user_progress_upload_id_fkey
  foreign key (upload_id) references academy_swing_uploads(id) on delete cascade;

-- Purge any videos uploaded during testing, then remove the bucket.
delete from storage.objects where bucket_id = 'academy-videos';
delete from storage.buckets where id = 'academy-videos';
