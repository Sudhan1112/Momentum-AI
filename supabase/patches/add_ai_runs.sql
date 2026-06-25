-- Sprint 5A: auditable AI run records.
-- Every future LLM execution starts pending and ends completed or failed.

create table if not exists public.ai_runs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  capability public.ai_capability not null,
  status public.ai_run_status not null default 'pending',
  model text,
  prompt_version text,
  input_summary text,
  output_summary text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  error_message text,
  created_at timestamptz default now() not null,
  completed_at timestamptz
);

create index if not exists ai_runs_user_created_idx
  on public.ai_runs(user_id, created_at desc);

create index if not exists ai_runs_project_created_idx
  on public.ai_runs(project_id, created_at desc)
  where project_id is not null;

create index if not exists ai_runs_task_created_idx
  on public.ai_runs(task_id, created_at desc)
  where task_id is not null;

alter table public.ai_runs enable row level security;

drop policy if exists "Users can view their AI runs." on public.ai_runs;
drop policy if exists "Project members can view project AI runs." on public.ai_runs;
drop policy if exists "Users can create their AI runs." on public.ai_runs;
drop policy if exists "Users can update their AI runs." on public.ai_runs;

create policy "Users can view their AI runs." on public.ai_runs for select
  using (auth.uid() = user_id);

create policy "Project members can view project AI runs." on public.ai_runs for select
  using (project_id is not null and public.is_project_member(project_id));

create policy "Users can create their AI runs." on public.ai_runs for insert
  with check (auth.uid() = user_id);

create policy "Users can update their AI runs." on public.ai_runs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
