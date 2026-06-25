-- Sprint 6: goal simulations.
-- Simulations are deterministic projections with optional Momentum narrative.
-- They do not mutate projects, tasks, documents, recovery plans, or planner data.

create table if not exists public.goal_simulations (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  created_by uuid references public.profiles(id) on delete set null not null,
  ai_run_id uuid references public.ai_runs(id) on delete set null,
  scenario_name text not null default 'Goal simulation',
  inputs jsonb not null default '{}'::jsonb,
  current_state jsonb not null default '{}'::jsonb,
  projected_state jsonb not null default '{}'::jsonb,
  timeline_projection jsonb not null default '{}'::jsonb,
  critical_tasks jsonb not null default '[]'::jsonb,
  recommended_actions jsonb not null default '[]'::jsonb,
  explanation text,
  created_at timestamptz default now() not null
);

create index if not exists goal_simulations_project_created_idx
  on public.goal_simulations(project_id, created_at desc);

create index if not exists goal_simulations_created_by_idx
  on public.goal_simulations(created_by, created_at desc);

alter table public.goal_simulations enable row level security;

drop policy if exists "Project members can view goal simulations." on public.goal_simulations;
drop policy if exists "Project writers can create goal simulations." on public.goal_simulations;

create policy "Project members can view goal simulations." on public.goal_simulations for select
  using (public.is_project_member(project_id));

create policy "Project writers can create goal simulations." on public.goal_simulations for insert
  with check (auth.uid() = created_by and public.has_project_write_role(project_id));

select pg_notify('pgrst', 'reload schema');
