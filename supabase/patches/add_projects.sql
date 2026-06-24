-- Sprint 1: projects table and RLS.

create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  title text not null check (char_length(trim(title)) > 0 and char_length(title) <= 200),
  description text check (description is null or char_length(description) <= 10000),
  owner_id uuid references public.profiles(id) on delete cascade not null,
  status public.project_status not null default 'active',
  target_deadline timestamptz,
  goal_summary text check (goal_summary is null or char_length(goal_summary) <= 10000),
  execution_target_score smallint check (execution_target_score is null or execution_target_score between 0 and 100),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists projects_owner_updated_idx
  on public.projects(owner_id, updated_at desc);

create index if not exists projects_status_deadline_idx
  on public.projects(status, target_deadline);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute procedure public.set_updated_at();

alter table public.projects enable row level security;

drop policy if exists "Project members can view projects." on public.projects;
drop policy if exists "Users can create owned projects." on public.projects;
drop policy if exists "Project owners can update projects." on public.projects;
drop policy if exists "Project owners can delete projects." on public.projects;

create policy "Project members can view projects." on public.projects for select
  using (auth.uid() = owner_id or public.is_project_member(id));

create policy "Users can create owned projects." on public.projects for insert
  with check (auth.uid() = owner_id);

create policy "Project owners can update projects." on public.projects for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Project owners can delete projects." on public.projects for delete
  using (auth.uid() = owner_id);

