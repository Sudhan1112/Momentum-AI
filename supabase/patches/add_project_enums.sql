-- Sprint 1: project and task enums.
-- Apply before creating projects, project_members, and tasks.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'project_status') then
    create type public.project_status as enum ('active', 'paused', 'completed', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum ('backlog', 'todo', 'in_progress', 'blocked', 'done', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'task_priority') then
    create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
  end if;
end $$;

