-- 0025 — grubs attach to posts (SCHEMA.md). The feed and profile now read the
-- unified `posts` table, so grubs key on (subject_type='post', subject_id=post.id).
-- Widen the allowed subject_type to include 'post' (keep 'yonder'/'map' so any
-- legacy rows stay valid). The primary key (user_id, subject_type, subject_id)
-- is unchanged.

alter table public.grubs drop constraint if exists grubs_subject_type_check;
alter table public.grubs
  add constraint grubs_subject_type_check
  check (subject_type in ('yonder', 'map', 'post'));
