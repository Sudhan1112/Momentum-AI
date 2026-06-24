-- Sprint 4: deterministic recovery plans.
-- Plans are proposed by code, reviewed by users, and do not auto-mutate tasks.

do $$
begin
  create type public.recovery_plan_status as enum ('proposed', 'applied', 'dismissed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.recovery_plans (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  created_by uuid references public.profiles(id) on delete set null not null,
  status public.recovery_plan_status not null default 'proposed',
  trigger_reasons text[] not null default '{}',
  summary text not null,
  actions jsonb not null default '[]'::jsonb,
  before_execution_score integer not null check (before_execution_score >= 0 and before_execution_score <= 100),
  after_execution_score integer not null check (after_execution_score >= 0 and after_execution_score <= 100),
  before_health text not null check (before_health in ('healthy', 'attention', 'critical')),
  after_health text not null check (after_health in ('healthy', 'attention', 'critical')),
  before_success_probability integer not null check (before_success_probability >= 0 and before_success_probability <= 100),
  after_success_probability integer not null check (after_success_probability >= 0 and after_success_probability <= 100),
  confidence_score integer not null check (confidence_score >= 0 and confidence_score <= 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists recovery_plans_project_created_idx
  on public.recovery_plans(project_id, created_at desc);

create index if not exists recovery_plans_project_status_idx
  on public.recovery_plans(project_id, status, created_at desc);

drop trigger if exists recovery_plans_set_updated_at on public.recovery_plans;
create trigger recovery_plans_set_updated_at
  before update on public.recovery_plans
  for each row execute procedure public.set_updated_at();

alter table public.recovery_plans enable row level security;

drop policy if exists "Project members can view recovery plans." on public.recovery_plans;
drop policy if exists "Project writers can create recovery plans." on public.recovery_plans;
drop policy if exists "Project writers can update recovery plans." on public.recovery_plans;

create policy "Project members can view recovery plans." on public.recovery_plans for select
  using (public.is_project_member(project_id));

create policy "Project writers can create recovery plans." on public.recovery_plans for insert
  with check (auth.uid() = created_by and public.has_project_write_role(project_id));

create policy "Project writers can update recovery plans." on public.recovery_plans for update
  using (public.has_project_write_role(project_id))
  with check (public.has_project_write_role(project_id));
