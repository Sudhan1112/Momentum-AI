-- Sprint 7: Momentum Flow proposal-based scheduling.
-- Schedules are separate from tasks and never mutate task due dates automatically.

do $$
begin
  create type public.momentum_flow_proposal_status as enum ('proposed', 'applied', 'dismissed', 'expired');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.momentum_flow_session_status as enum ('proposed', 'scheduled', 'locked', 'completed', 'skipped');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.focus_session_type as enum ('deep_work', 'quick_win', 'admin', 'learning', 'meeting', 'break');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.energy_requirement as enum ('high', 'medium', 'low');
exception
  when duplicate_object then null;
end $$;

alter type public.ai_capability add value if not exists 'momentum_flow';

create table if not exists public.momentum_flow_proposals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete cascade,
  ai_run_id uuid references public.ai_runs(id) on delete set null,
  schedule_date date not null,
  horizon_days integer not null default 1 check (horizon_days >= 1 and horizon_days <= 7),
  version integer not null default 1 check (version >= 1),
  status public.momentum_flow_proposal_status not null default 'proposed',
  input_snapshot jsonb not null default '{}'::jsonb,
  capacity_summary jsonb not null default '{}'::jsonb,
  confidence integer not null default 0 check (confidence >= 0 and confidence <= 100),
  insights jsonb not null default '{}'::jsonb,
  backlog_remaining jsonb not null default '{}'::jsonb,
  explanation_summary text,
  applied_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists momentum_flow_proposals_user_date_idx
  on public.momentum_flow_proposals(user_id, schedule_date desc, version desc);

create index if not exists momentum_flow_proposals_project_date_idx
  on public.momentum_flow_proposals(project_id, schedule_date desc, version desc);

create table if not exists public.momentum_flow_sessions (
  id uuid default gen_random_uuid() primary key,
  proposal_id uuid references public.momentum_flow_proposals(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  session_type public.focus_session_type not null,
  energy_requirement public.energy_requirement not null,
  status public.momentum_flow_session_status not null default 'proposed',
  score integer not null default 0 check (score >= 0 and score <= 100),
  rationale text not null,
  is_manual_override boolean not null default false,
  is_locked boolean not null default false,
  source text not null default 'deterministic',
  external_event_id text,
  calendar_provider text,
  calendar_status text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  check (end_at > start_at)
);

create index if not exists momentum_flow_sessions_user_start_idx
  on public.momentum_flow_sessions(user_id, start_at, status);

create index if not exists momentum_flow_sessions_proposal_idx
  on public.momentum_flow_sessions(proposal_id, start_at);

create index if not exists momentum_flow_sessions_task_idx
  on public.momentum_flow_sessions(task_id, start_at desc);

create table if not exists public.user_capacity_profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  weekday integer not null check (weekday >= 0 and weekday <= 6),
  default_minutes integer not null default 240 check (default_minutes >= 0),
  learned_minutes integer check (learned_minutes >= 0),
  confidence integer not null default 0 check (confidence >= 0 and confidence <= 100),
  sample_count integer not null default 0 check (sample_count >= 0),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(user_id, weekday)
);

drop trigger if exists momentum_flow_proposals_set_updated_at on public.momentum_flow_proposals;
create trigger momentum_flow_proposals_set_updated_at
  before update on public.momentum_flow_proposals
  for each row execute procedure public.set_updated_at();

drop trigger if exists momentum_flow_sessions_set_updated_at on public.momentum_flow_sessions;
create trigger momentum_flow_sessions_set_updated_at
  before update on public.momentum_flow_sessions
  for each row execute procedure public.set_updated_at();

drop trigger if exists user_capacity_profiles_set_updated_at on public.user_capacity_profiles;
create trigger user_capacity_profiles_set_updated_at
  before update on public.user_capacity_profiles
  for each row execute procedure public.set_updated_at();

alter table public.momentum_flow_proposals enable row level security;
alter table public.momentum_flow_sessions enable row level security;
alter table public.user_capacity_profiles enable row level security;

drop policy if exists "Users can view own momentum flow proposals." on public.momentum_flow_proposals;
drop policy if exists "Users can create own momentum flow proposals." on public.momentum_flow_proposals;
drop policy if exists "Users can update own momentum flow proposals." on public.momentum_flow_proposals;

create policy "Users can view own momentum flow proposals." on public.momentum_flow_proposals for select
  using (auth.uid() = user_id);

create policy "Users can create own momentum flow proposals." on public.momentum_flow_proposals for insert
  with check (auth.uid() = user_id and (project_id is null or public.is_project_member(project_id)));

create policy "Users can update own momentum flow proposals." on public.momentum_flow_proposals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and (project_id is null or public.is_project_member(project_id)));

drop policy if exists "Users can view own momentum flow sessions." on public.momentum_flow_sessions;
drop policy if exists "Users can create own momentum flow sessions." on public.momentum_flow_sessions;
drop policy if exists "Users can update own momentum flow sessions." on public.momentum_flow_sessions;

create policy "Users can view own momentum flow sessions." on public.momentum_flow_sessions for select
  using (auth.uid() = user_id);

create policy "Users can create own momentum flow sessions." on public.momentum_flow_sessions for insert
  with check (auth.uid() = user_id and (project_id is null or public.is_project_member(project_id)));

create policy "Users can update own momentum flow sessions." on public.momentum_flow_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and (project_id is null or public.is_project_member(project_id)));

drop policy if exists "Users can view own capacity profile." on public.user_capacity_profiles;
drop policy if exists "Users can create own capacity profile." on public.user_capacity_profiles;
drop policy if exists "Users can update own capacity profile." on public.user_capacity_profiles;

create policy "Users can view own capacity profile." on public.user_capacity_profiles for select
  using (auth.uid() = user_id);

create policy "Users can create own capacity profile." on public.user_capacity_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own capacity profile." on public.user_capacity_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

select pg_notify('pgrst', 'reload schema');
