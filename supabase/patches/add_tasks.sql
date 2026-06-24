-- Sprint 1: project-scoped tasks and RLS.
-- Document linking is intentionally deferred; no document_id column in Sprint 1.

create table if not exists public.tasks (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null check (char_length(trim(title)) > 0 and char_length(title) <= 200),
  description text check (description is null or char_length(description) <= 10000),
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  assignee_id uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  estimate_minutes integer check (estimate_minutes is null or estimate_minutes >= 0),
  actual_minutes integer check (actual_minutes is null or actual_minutes >= 0),
  sort_order integer not null default 0,
  blocked_at timestamptz,
  blocked_reason text check (blocked_reason is null or char_length(blocked_reason) <= 10000),
  created_by uuid references public.profiles(id) on delete set null not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists tasks_project_sort_idx
  on public.tasks(project_id, sort_order, created_at);

create index if not exists tasks_project_status_due_idx
  on public.tasks(project_id, status, due_at);

create index if not exists tasks_assignee_idx
  on public.tasks(assignee_id, due_at);

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute procedure public.set_updated_at();

alter table public.tasks enable row level security;

drop policy if exists "Project members can view tasks." on public.tasks;
drop policy if exists "Project writers can create tasks." on public.tasks;
drop policy if exists "Project writers can update tasks." on public.tasks;
drop policy if exists "Project admins can delete tasks." on public.tasks;

create policy "Project members can view tasks." on public.tasks for select
  using (public.is_project_member(project_id));

create policy "Project writers can create tasks." on public.tasks for insert
  with check (auth.uid() = created_by and public.has_project_write_role(project_id));

create policy "Project writers can update tasks." on public.tasks for update
  using (public.has_project_write_role(project_id))
  with check (public.has_project_write_role(project_id));

create policy "Project admins can delete tasks." on public.tasks for delete
  using (public.has_project_admin_role(project_id));

