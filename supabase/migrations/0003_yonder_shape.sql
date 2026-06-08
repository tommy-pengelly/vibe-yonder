-- Vibe Yonder: reconcile the yonders table with the SavedYonder type.
-- Doc 1 grew the walk model (mode / multiple destinations / paused time /
-- source-list link) after 0001 froze the schema. Add the missing columns so
-- cloud sync can round-trip a full SavedYonder.

alter table yonders
  add column if not exists mode text not null default 'single'
    check (mode in ('single', 'collection', 'ordered')),
  add column if not exists destinations jsonb not null default '[]'::jsonb,
  add column if not exists paused_ms integer not null default 0,
  add column if not exists list_id uuid;
