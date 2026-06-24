-- Sprint 3: deterministic task risk score history.
-- Append-only scores power risk chips, execution score, and workspace health.

create table if not exists public.task_risk_scores (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete cascade not null,
  score numeric(5, 4) not null check (score >= 0 and score <= 1),
  level text not null check (level in ('low', 'medium', 'high', 'critical')),
  confidence numeric(5, 4) not null check (confidence >= 0 and confidence <= 1),
  factors jsonb not null default '{}'::jsonb,
  explanation text not null,
  scored_at timestamptz default now() not null,
  created_at timestamptz default now() not null
);

create index if not exists task_risk_scores_task_scored_idx
  on public.task_risk_scores(task_id, scored_at desc);

create index if not exists task_risk_scores_project_scored_idx
  on public.task_risk_scores(project_id, scored_at desc);

alter table public.task_risk_scores enable row level security;

drop policy if exists "Project members can view task risk scores." on public.task_risk_scores;

create policy "Project members can view task risk scores." on public.task_risk_scores for select
  using (public.is_project_member(project_id));
