-- Doc 6 (Completion loop): a description on the yonder itself, written in the
-- recap. Pre-fills the share caption (which previously lived only on
-- shared_yonders). Nullable + additive; RLS unchanged (owner-only via table).
alter table public.yonders add column if not exists caption text;
