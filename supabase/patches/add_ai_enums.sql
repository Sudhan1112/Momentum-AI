-- Sprint 5A: AI infrastructure enums.
-- These values define the auditable capability/status/source vocabulary.

do $$
begin
  create type public.ai_capability as enum (
    'extract_tasks',
    'work_breakdown',
    'blocker_detection',
    'morning_brief',
    'recovery_plan',
    'goal_simulation',
    'risk_explain'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.ai_run_status as enum (
    'pending',
    'completed',
    'failed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.ai_citation_source_type as enum (
    'document',
    'document_comment',
    'document_version',
    'task',
    'project',
    'memory_entry'
  );
exception
  when duplicate_object then null;
end $$;
