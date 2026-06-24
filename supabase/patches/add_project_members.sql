-- Sprint 1: project membership roster and RLS.

create table if not exists public.project_members (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role public.app_role not null default 'viewer',
  created_at timestamptz default now() not null,
  unique(project_id, user_id)
);

create index if not exists project_members_user_idx
  on public.project_members(user_id, project_id);

alter table public.project_members enable row level security;

drop policy if exists "Project members can view roster." on public.project_members;
drop policy if exists "Project admins can add members." on public.project_members;
drop policy if exists "Project admins can update member roles." on public.project_members;
drop policy if exists "Project admins or self can remove members." on public.project_members;

create policy "Project members can view roster." on public.project_members for select
  using (public.is_project_member(project_id));

create policy "Project admins can add members." on public.project_members for insert
  with check (public.has_project_admin_role(project_id));

create policy "Project admins can update member roles." on public.project_members for update
  using (public.has_project_admin_role(project_id))
  with check (public.has_project_admin_role(project_id));

create policy "Project admins or self can remove members." on public.project_members for delete
  using (user_id = auth.uid() or public.has_project_admin_role(project_id));

