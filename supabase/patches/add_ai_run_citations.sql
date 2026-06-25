-- Sprint 5A: citations attached to AI runs.
-- Citations keep future AI answers traceable without storing document bodies wholesale.

create table if not exists public.ai_run_citations (
  id uuid default gen_random_uuid() primary key,
  ai_run_id uuid references public.ai_runs(id) on delete cascade not null,
  source_type public.ai_citation_source_type not null,
  source_id text not null,
  excerpt text,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz default now() not null
);

create index if not exists ai_run_citations_run_order_idx
  on public.ai_run_citations(ai_run_id, sort_order asc, created_at asc);

alter table public.ai_run_citations enable row level security;

drop policy if exists "Users can view citations for readable AI runs." on public.ai_run_citations;
drop policy if exists "Users can create citations for owned AI runs." on public.ai_run_citations;

create policy "Users can view citations for readable AI runs." on public.ai_run_citations for select
  using (
    exists (
      select 1
      from public.ai_runs r
      where r.id = ai_run_id
        and (
          r.user_id = auth.uid()
          or (r.project_id is not null and public.is_project_member(r.project_id))
        )
    )
  );

create policy "Users can create citations for owned AI runs." on public.ai_run_citations for insert
  with check (
    exists (
      select 1
      from public.ai_runs r
      where r.id = ai_run_id
        and r.user_id = auth.uid()
    )
  );
