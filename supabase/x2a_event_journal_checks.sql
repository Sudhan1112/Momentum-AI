-- X2A verification checks. Run in the Supabase SQL editor after applying
-- supabase/patches/add_project_event_journal.sql.
-- The mutation checks run inside a transaction and are rolled back.

do $$
begin
  if to_regclass('public.project_events') is null then
    raise exception 'project_events is missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'project_events'
      and column_name = 'schema_version'
  ) then
    raise exception 'project_events.schema_version is missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_events'
      and cmd = 'SELECT'
  ) then
    raise exception 'project_events SELECT policy is missing';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_events'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception 'project_events must not expose mutation policies';
  end if;
end $$;

begin;

do $$
declare
  sample_project_id uuid;
  sample_event_id uuid;
  update_blocked boolean := false;
  delete_blocked boolean := false;
begin
  select id into sample_project_id from public.projects order by created_at asc limit 1;
  if sample_project_id is null then
    raise notice 'No project exists; skipping row immutability checks.';
    return;
  end if;

  insert into public.project_events (
    project_id, event_key, event_type, entity_type, entity_id, source,
    importance, summary, before_state, after_state, metadata
  ) values (
    sample_project_id, 'verification:' || gen_random_uuid(), 'project.updated',
    'project', sample_project_id, 'system', 'low', 'Verification event',
    '{}'::jsonb, '{}'::jsonb, '{}'::jsonb
  ) returning id into sample_event_id;

  begin
    update public.project_events set summary = 'Rewritten' where id = sample_event_id;
  exception when others then
    update_blocked := true;
  end;

  begin
    delete from public.project_events where id = sample_event_id;
  exception when others then
    delete_blocked := true;
  end;

  if not update_blocked or not delete_blocked then
    raise exception 'Project event immutability check failed';
  end if;
end $$;

rollback;

select public.import_project_history_v1() as first_import;
select public.import_project_history_v1() as idempotency_check;

select event_key, count(*)
from public.project_events
group by event_key
having count(*) > 1;
