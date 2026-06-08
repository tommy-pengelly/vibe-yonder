-- Vibe Yonder: rename "lists" to "maps".
-- A yonder is the activity; a *map* is the plan (a saved, reusable, shareable
-- set of places). Bring the schema in line with the vocabulary. Tables are
-- empty at rename time, so this is purely structural.

alter table lists rename to maps;
alter table list_items rename to map_items;
alter table map_items rename column list_id to map_id;

-- A yonder can be launched from a saved map; rename its back-reference.
alter table yonders rename column list_id to map_id;

-- A save-for-later "list" bookmark is really a map (a set of places).
alter table saved drop constraint saved_kind_check;
alter table saved add constraint saved_kind_check check (kind in ('place', 'map'));
