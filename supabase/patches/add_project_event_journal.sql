-- Sprint X2A: immutable, project-scoped event journal.
-- Apply after the Sprint 1-7 patches. This patch is idempotent.

create table if not exists public.project_events (
  id uuid default gen_random_uuid() primary key,
  sequence bigint generated always as identity unique,
  project_id uuid references public.projects(id) on delete cascade not null,
  schema_version smallint not null default 1 check (schema_version >= 1),
  event_key text not null unique check (char_length(event_key) between 1 and 300),
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
  entity_type text not null check (entity_type ~ '^[a-z][a-z0-9_]*$'),
  entity_id uuid,
  actor_id uuid references public.profiles(id) on delete set null,
  source text not null check (source in ('user', 'system', 'ai')),
  importance text not null default 'normal' check (importance in ('low', 'normal', 'high', 'critical')),
  summary text not null check (char_length(trim(summary)) between 1 and 500),
  reason text check (reason is null or char_length(reason) <= 2000),
  before_state jsonb not null default '{}'::jsonb check (jsonb_typeof(before_state) = 'object'),
  after_state jsonb not null default '{}'::jsonb check (jsonb_typeof(after_state) = 'object'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  confidence smallint not null default 100 check (confidence between 0 and 100),
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  is_historical_import boolean not null default false,
  search_document tsvector generated always as (
    to_tsvector('english', coalesce(summary, '') || ' ' || coalesce(reason, ''))
  ) stored
);

create index if not exists project_events_project_sequence_idx
  on public.project_events(project_id, sequence desc);

create index if not exists project_events_project_occurred_idx
  on public.project_events(project_id, occurred_at desc, sequence desc);

create index if not exists project_events_entity_idx
  on public.project_events(project_id, entity_type, entity_id, sequence desc);

create index if not exists project_events_importance_idx
  on public.project_events(project_id, importance, occurred_at desc);

create index if not exists project_events_search_idx
  on public.project_events using gin(search_document);

alter table public.project_events enable row level security;

drop policy if exists "Project members can view project events." on public.project_events;
create policy "Project members can view project events." on public.project_events for select
  using (public.is_project_member(project_id));

create or replace function public.prevent_project_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'Project events are immutable';
  end if;

  -- A parent project deletion is the only supported event deletion path.
  if pg_trigger_depth() <= 1 and exists (select 1 from public.projects p where p.id = old.project_id) then
    raise exception 'Project events are immutable';
  end if;

  return old;
end;
$$;

drop trigger if exists project_events_prevent_update_delete on public.project_events;
create trigger project_events_prevent_update_delete
  before update or delete on public.project_events
  for each row execute procedure public.prevent_project_event_mutation();

create or replace function public.insert_project_event_specs(
  p_project_id uuid,
  p_actor_id uuid,
  p_mutation_id uuid,
  p_default_entity_id uuid,
  p_events jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  if jsonb_typeof(coalesce(p_events, '[]'::jsonb)) <> 'array' then
    raise exception 'events must be a JSON array';
  end if;

  insert into public.project_events (
    project_id,
    schema_version,
    event_key,
    event_type,
    entity_type,
    entity_id,
    actor_id,
    source,
    importance,
    summary,
    reason,
    before_state,
    after_state,
    metadata,
    confidence,
    occurred_at,
    is_historical_import
  )
  select
    p_project_id,
    coalesce((item.value->>'schema_version')::smallint, 1),
    p_mutation_id::text || ':' || item.ordinality::text,
    item.value->>'event_type',
    item.value->>'entity_type',
    coalesce(nullif(item.value->>'entity_id', '')::uuid, p_default_entity_id),
    p_actor_id,
    coalesce(nullif(item.value->>'source', ''), 'user'),
    coalesce(nullif(item.value->>'importance', ''), 'normal'),
    item.value->>'summary',
    nullif(item.value->>'reason', ''),
    coalesce(item.value->'before_state', '{}'::jsonb),
    coalesce(item.value->'after_state', '{}'::jsonb),
    coalesce(item.value->'metadata', '{}'::jsonb),
    coalesce((item.value->>'confidence')::smallint, 100),
    coalesce((item.value->>'occurred_at')::timestamptz, now()),
    false
  from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) with ordinality as item(value, ordinality)
  on conflict (event_key) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.insert_project_event_specs(uuid, uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.insert_project_event_specs(uuid, uuid, uuid, uuid, jsonb) to service_role;

create or replace function public.create_project_with_events(
  p_actor_id uuid,
  p_payload jsonb,
  p_mutation_id uuid,
  p_events jsonb
)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  created_project public.projects;
begin
  if p_actor_id is null then raise exception 'actor_id is required'; end if;

  insert into public.projects (
    title, description, owner_id, status, target_deadline, goal_summary, execution_target_score
  )
  values (
    p_payload->>'title',
    nullif(p_payload->>'description', ''),
    p_actor_id,
    coalesce((p_payload->>'status')::public.project_status, 'active'::public.project_status),
    (p_payload->>'target_deadline')::timestamptz,
    nullif(p_payload->>'goal_summary', ''),
    (p_payload->>'execution_target_score')::smallint
  )
  returning * into created_project;

  insert into public.project_members(project_id, user_id, role)
  values (created_project.id, p_actor_id, 'owner')
  on conflict (project_id, user_id) do update set role = 'owner';

  perform public.insert_project_event_specs(
    created_project.id, p_actor_id, p_mutation_id, created_project.id, p_events
  );

  return created_project;
end;
$$;

create or replace function public.update_project_with_events(
  p_project_id uuid,
  p_actor_id uuid,
  p_expected_updated_at timestamptz,
  p_payload jsonb,
  p_mutation_id uuid,
  p_events jsonb
)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  current_project public.projects;
  updated_project public.projects;
begin
  select * into current_project from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found'; end if;
  if current_project.owner_id <> p_actor_id then raise exception 'Forbidden'; end if;
  if current_project.updated_at <> p_expected_updated_at then raise exception 'Mutation conflict'; end if;

  update public.projects
  set
    title = case when p_payload ? 'title' then p_payload->>'title' else title end,
    description = case when p_payload ? 'description' then nullif(p_payload->>'description', '') else description end,
    status = case when p_payload ? 'status' then (p_payload->>'status')::public.project_status else status end,
    target_deadline = case when p_payload ? 'target_deadline' then (p_payload->>'target_deadline')::timestamptz else target_deadline end,
    goal_summary = case when p_payload ? 'goal_summary' then nullif(p_payload->>'goal_summary', '') else goal_summary end,
    execution_target_score = case when p_payload ? 'execution_target_score' then (p_payload->>'execution_target_score')::smallint else execution_target_score end
  where id = p_project_id
  returning * into updated_project;

  perform public.insert_project_event_specs(
    p_project_id, p_actor_id, p_mutation_id, p_project_id, p_events
  );

  return updated_project;
end;
$$;

create or replace function public.create_task_with_events(
  p_project_id uuid,
  p_actor_id uuid,
  p_payload jsonb,
  p_mutation_id uuid,
  p_events jsonb
)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  created_task public.tasks;
begin
  if not exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = p_actor_id and role in ('owner', 'admin', 'editor')
  ) then raise exception 'Forbidden'; end if;

  insert into public.tasks (
    project_id, title, description, status, priority, assignee_id, due_at, started_at,
    completed_at, estimate_minutes, actual_minutes, sort_order, blocked_at, blocked_reason, created_by
  )
  values (
    p_project_id,
    p_payload->>'title',
    nullif(p_payload->>'description', ''),
    coalesce((p_payload->>'status')::public.task_status, 'todo'::public.task_status),
    coalesce((p_payload->>'priority')::public.task_priority, 'medium'::public.task_priority),
    (p_payload->>'assignee_id')::uuid,
    (p_payload->>'due_at')::timestamptz,
    (p_payload->>'started_at')::timestamptz,
    (p_payload->>'completed_at')::timestamptz,
    (p_payload->>'estimate_minutes')::integer,
    (p_payload->>'actual_minutes')::integer,
    coalesce((p_payload->>'sort_order')::integer, 0),
    (p_payload->>'blocked_at')::timestamptz,
    nullif(p_payload->>'blocked_reason', ''),
    p_actor_id
  )
  returning * into created_task;

  perform public.insert_project_event_specs(
    p_project_id, p_actor_id, p_mutation_id, created_task.id, p_events
  );

  return created_task;
end;
$$;

create or replace function public.update_task_with_events(
  p_task_id uuid,
  p_actor_id uuid,
  p_expected_updated_at timestamptz,
  p_payload jsonb,
  p_mutation_id uuid,
  p_events jsonb
)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  current_task public.tasks;
  updated_task public.tasks;
begin
  select * into current_task from public.tasks where id = p_task_id for update;
  if not found then raise exception 'Task not found'; end if;
  if not exists (
    select 1 from public.project_members
    where project_id = current_task.project_id and user_id = p_actor_id and role in ('owner', 'admin', 'editor')
  ) then raise exception 'Forbidden'; end if;
  if current_task.updated_at <> p_expected_updated_at then raise exception 'Mutation conflict'; end if;

  update public.tasks
  set
    title = case when p_payload ? 'title' then p_payload->>'title' else title end,
    description = case when p_payload ? 'description' then nullif(p_payload->>'description', '') else description end,
    status = case when p_payload ? 'status' then (p_payload->>'status')::public.task_status else status end,
    priority = case when p_payload ? 'priority' then (p_payload->>'priority')::public.task_priority else priority end,
    assignee_id = case when p_payload ? 'assignee_id' then (p_payload->>'assignee_id')::uuid else assignee_id end,
    due_at = case when p_payload ? 'due_at' then (p_payload->>'due_at')::timestamptz else due_at end,
    started_at = case when p_payload ? 'started_at' then (p_payload->>'started_at')::timestamptz else started_at end,
    completed_at = case when p_payload ? 'completed_at' then (p_payload->>'completed_at')::timestamptz else completed_at end,
    estimate_minutes = case when p_payload ? 'estimate_minutes' then (p_payload->>'estimate_minutes')::integer else estimate_minutes end,
    actual_minutes = case when p_payload ? 'actual_minutes' then (p_payload->>'actual_minutes')::integer else actual_minutes end,
    sort_order = case when p_payload ? 'sort_order' then (p_payload->>'sort_order')::integer else sort_order end,
    blocked_at = case when p_payload ? 'blocked_at' then (p_payload->>'blocked_at')::timestamptz else blocked_at end,
    blocked_reason = case when p_payload ? 'blocked_reason' then nullif(p_payload->>'blocked_reason', '') else blocked_reason end
  where id = p_task_id
  returning * into updated_task;

  perform public.insert_project_event_specs(
    updated_task.project_id, p_actor_id, p_mutation_id, p_task_id, p_events
  );

  return updated_task;
end;
$$;

create or replace function public.delete_task_with_events(
  p_task_id uuid,
  p_actor_id uuid,
  p_expected_updated_at timestamptz,
  p_mutation_id uuid,
  p_events jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_task public.tasks;
begin
  select * into current_task from public.tasks where id = p_task_id for update;
  if not found then raise exception 'Task not found'; end if;
  if not exists (
    select 1 from public.project_members
    where project_id = current_task.project_id and user_id = p_actor_id and role in ('owner', 'admin', 'editor')
  ) then raise exception 'Forbidden'; end if;
  if current_task.updated_at <> p_expected_updated_at then raise exception 'Mutation conflict'; end if;

  perform public.insert_project_event_specs(
    current_task.project_id, p_actor_id, p_mutation_id, p_task_id, p_events
  );
  delete from public.tasks where id = p_task_id;
  return true;
end;
$$;

revoke all on function public.create_project_with_events(uuid, jsonb, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.update_project_with_events(uuid, uuid, timestamptz, jsonb, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.create_task_with_events(uuid, uuid, jsonb, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.update_task_with_events(uuid, uuid, timestamptz, jsonb, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.delete_task_with_events(uuid, uuid, timestamptz, uuid, jsonb) from public, anon, authenticated;

grant execute on function public.create_project_with_events(uuid, jsonb, uuid, jsonb) to service_role;
grant execute on function public.update_project_with_events(uuid, uuid, timestamptz, jsonb, uuid, jsonb) to service_role;
grant execute on function public.create_task_with_events(uuid, uuid, jsonb, uuid, jsonb) to service_role;
grant execute on function public.update_task_with_events(uuid, uuid, timestamptz, jsonb, uuid, jsonb) to service_role;
grant execute on function public.delete_task_with_events(uuid, uuid, timestamptz, uuid, jsonb) to service_role;

create or replace function public.capture_project_artifact_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_actor_id uuid;
  v_event_key text;
  v_event_type text;
  v_entity_type text := tg_table_name;
  v_entity_id uuid;
  v_source text := 'system';
  v_importance text := 'normal';
  v_summary text;
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
begin
  if tg_table_name = 'recovery_plans' then
    v_project_id := new.project_id;
    v_actor_id := new.created_by;
    v_entity_id := new.id;
    if tg_op = 'INSERT' then
      v_event_type := 'recovery.generated';
      v_event_key := 'recovery:' || new.id || ':generated';
      v_importance := 'high';
      v_summary := 'Recovery plan generated';
    elsif old.status is distinct from new.status then
      v_event_type := 'recovery.status_changed';
      v_event_key := 'recovery:' || new.id || ':status:' || new.status::text || ':' ||
        md5(new.updated_at::text || new.status::text);
      v_importance := 'high';
      v_summary := 'Recovery plan status changed to ' || new.status::text;
      v_before := jsonb_build_object('status', old.status);
    else return new;
    end if;
    v_after := jsonb_build_object(
      'status', new.status,
      'before_execution_score', new.before_execution_score,
      'after_execution_score', new.after_execution_score,
      'confidence_score', new.confidence_score
    );
  elsif tg_table_name = 'goal_simulations' then
    if tg_op <> 'INSERT' then return new; end if;
    v_project_id := new.project_id;
    v_actor_id := new.created_by;
    v_entity_id := new.id;
    v_event_type := 'simulation.created';
    v_event_key := 'simulation:' || new.id || ':created';
    v_importance := 'high';
    v_summary := 'Goal simulation created';
    v_after := jsonb_build_object('scenario_name', new.scenario_name);
  elsif tg_table_name = 'ai_runs' then
    if tg_op <> 'UPDATE' or new.project_id is null or old.status is not distinct from new.status
       or new.status not in ('completed', 'failed') then return new; end if;
    v_project_id := new.project_id;
    v_actor_id := new.user_id;
    v_entity_id := new.id;
    v_source := 'ai';
    v_event_type := 'ai_run.' || new.status::text;
    v_event_key := 'ai_run:' || new.id || ':' || new.status::text;
    v_summary := 'AI ' || replace(new.capability::text, '_', ' ') || ' run ' || new.status::text;
    v_after := jsonb_build_object(
      'capability', new.capability,
      'status', new.status,
      'prompt_version', new.prompt_version
    );
  elsif tg_table_name = 'momentum_flow_proposals' then
    if new.project_id is null then return new; end if;
    v_project_id := new.project_id;
    v_actor_id := new.user_id;
    v_entity_id := new.id;
    if tg_op = 'INSERT' then
      v_event_type := 'momentum_flow.proposed';
      v_event_key := 'momentum_flow:' || new.id || ':proposed';
      v_summary := 'Momentum Flow proposed';
    elsif old.status is distinct from new.status and new.status = 'applied' then
      v_event_type := 'momentum_flow.applied';
      v_event_key := 'momentum_flow:' || new.id || ':applied';
      v_importance := 'high';
      v_summary := 'Momentum Flow applied';
      v_before := jsonb_build_object('status', old.status);
    else return new;
    end if;
    v_after := jsonb_build_object(
      'status', new.status,
      'schedule_date', new.schedule_date,
      'confidence', new.confidence
    );
  elsif tg_table_name = 'momentum_flow_sessions' then
    if tg_op <> 'UPDATE' or new.project_id is null then return new; end if;
    v_project_id := new.project_id;
    v_actor_id := new.user_id;
    v_entity_id := new.id;
    if old.start_at is distinct from new.start_at or old.end_at is distinct from new.end_at then
      insert into public.project_events (
        project_id, schema_version, event_key, event_type, entity_type, entity_id, actor_id,
        source, importance, summary, before_state, after_state, metadata, confidence, occurred_at
      ) values (
        v_project_id, 1,
        'momentum_session:' || new.id || ':moved:' ||
          md5(new.updated_at::text || new.start_at::text || new.end_at::text || new.status::text),
        'momentum_session.moved', v_entity_type, v_entity_id, v_actor_id, 'system', 'normal',
        'Momentum session moved',
        jsonb_build_object('start_at', old.start_at, 'end_at', old.end_at),
        jsonb_build_object('start_at', new.start_at, 'end_at', new.end_at, 'status', new.status),
        '{}'::jsonb, 100, now()
      ) on conflict (event_key) do nothing;
    end if;

    if old.status is distinct from new.status and new.status in ('locked', 'completed', 'skipped') then
      insert into public.project_events (
        project_id, schema_version, event_key, event_type, entity_type, entity_id, actor_id,
        source, importance, summary, before_state, after_state, metadata, confidence, occurred_at
      ) values (
        v_project_id, 1,
        'momentum_session:' || new.id || ':' || new.status::text || ':' ||
          md5(new.updated_at::text || new.status::text || new.start_at::text || new.end_at::text),
        'momentum_session.' || new.status::text, v_entity_type, v_entity_id, v_actor_id, 'system',
        case when new.status = 'completed' then 'high' else 'normal' end,
        'Momentum session ' || new.status::text,
        jsonb_build_object('status', old.status),
        jsonb_build_object('status', new.status, 'start_at', new.start_at, 'end_at', new.end_at),
        '{}'::jsonb, 100, now()
      ) on conflict (event_key) do nothing;
    end if;

    return new;
  else
    return new;
  end if;

  insert into public.project_events (
    project_id, schema_version, event_key, event_type, entity_type, entity_id, actor_id,
    source, importance, summary, before_state, after_state, metadata, confidence, occurred_at
  ) values (
    v_project_id, 1, v_event_key, v_event_type, v_entity_type, v_entity_id, v_actor_id,
    v_source, v_importance, v_summary, v_before, v_after, '{}'::jsonb, 100, now()
  ) on conflict (event_key) do nothing;

  return new;
end;
$$;

revoke all on function public.prevent_project_event_mutation() from public, anon, authenticated;
revoke all on function public.capture_project_artifact_event() from public, anon, authenticated;

do $$
begin
  if to_regclass('public.recovery_plans') is not null then
    execute 'drop trigger if exists recovery_plans_capture_project_event on public.recovery_plans';
    execute 'create trigger recovery_plans_capture_project_event after insert or update of status on public.recovery_plans for each row execute procedure public.capture_project_artifact_event()';
  end if;
  if to_regclass('public.goal_simulations') is not null then
    execute 'drop trigger if exists goal_simulations_capture_project_event on public.goal_simulations';
    execute 'create trigger goal_simulations_capture_project_event after insert on public.goal_simulations for each row execute procedure public.capture_project_artifact_event()';
  end if;
  if to_regclass('public.ai_runs') is not null then
    execute 'drop trigger if exists ai_runs_capture_project_event on public.ai_runs';
    execute 'create trigger ai_runs_capture_project_event after update of status on public.ai_runs for each row execute procedure public.capture_project_artifact_event()';
  end if;
  if to_regclass('public.momentum_flow_proposals') is not null then
    execute 'drop trigger if exists momentum_flow_proposals_capture_project_event on public.momentum_flow_proposals';
    execute 'create trigger momentum_flow_proposals_capture_project_event after insert or update of status on public.momentum_flow_proposals for each row execute procedure public.capture_project_artifact_event()';
  end if;
  if to_regclass('public.momentum_flow_sessions') is not null then
    execute 'drop trigger if exists momentum_flow_sessions_capture_project_event on public.momentum_flow_sessions';
    execute 'create trigger momentum_flow_sessions_capture_project_event after update of status, start_at, end_at on public.momentum_flow_sessions for each row execute procedure public.capture_project_artifact_event()';
  end if;
end $$;

create or replace function public.import_project_history_v1()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  total_inserted integer := 0;
  batch_count integer := 0;
begin
  insert into public.project_events (
    project_id, schema_version, event_key, event_type, entity_type, entity_id, actor_id,
    source, importance, summary, after_state, metadata, confidence, occurred_at, is_historical_import
  )
  select
    p.id, 1, 'history:project:' || p.id, 'project.baseline_imported', 'project', p.id, p.owner_id,
    'system', 'normal', 'Project baseline imported',
    jsonb_strip_nulls(jsonb_build_object(
      'title', p.title, 'status', p.status, 'target_deadline', p.target_deadline,
      'execution_target_score', p.execution_target_score
    )),
    jsonb_build_object('import_kind', 'baseline', 'original_created_at', p.created_at), 100, p.updated_at, true
  from public.projects p
  on conflict (event_key) do nothing;
  get diagnostics batch_count = row_count;
  total_inserted := total_inserted + batch_count;

  insert into public.project_events (
    project_id, schema_version, event_key, event_type, entity_type, entity_id, actor_id,
    source, importance, summary, after_state, metadata, confidence, occurred_at, is_historical_import
  )
  select
    t.project_id, 1, 'history:task:' || t.id, 'task.baseline_imported', 'task', t.id, t.created_by,
    'system', case when t.status = 'blocked' then 'high' else 'normal' end,
    'Task baseline imported: ' || left(t.title, 200),
    jsonb_strip_nulls(jsonb_build_object(
      'title', t.title, 'status', t.status, 'priority', t.priority, 'assignee_id', t.assignee_id,
      'due_at', t.due_at, 'estimate_minutes', t.estimate_minutes,
      'actual_minutes', t.actual_minutes, 'blocked_reason', left(t.blocked_reason, 500)
    )),
    jsonb_build_object('import_kind', 'baseline', 'original_created_at', t.created_at), 100, t.updated_at, true
  from public.tasks t
  on conflict (event_key) do nothing;
  get diagnostics batch_count = row_count;
  total_inserted := total_inserted + batch_count;

  if to_regclass('public.recovery_plans') is not null then
    insert into public.project_events (
      project_id, schema_version, event_key, event_type, entity_type, entity_id, actor_id,
      source, importance, summary, after_state, metadata, confidence, occurred_at, is_historical_import
    )
    select
      r.project_id, 1, 'recovery:' || r.id || ':generated', 'recovery.generated', 'recovery_plans', r.id, r.created_by,
      'system', 'high', 'Recovery plan generated',
      jsonb_build_object(
        'status', r.status, 'before_execution_score', r.before_execution_score,
        'after_execution_score', r.after_execution_score, 'confidence_score', r.confidence_score
      ),
      jsonb_build_object('import_kind', 'existing_artifact'), 100, r.created_at, true
    from public.recovery_plans r
    on conflict (event_key) do nothing;
    get diagnostics batch_count = row_count;
    total_inserted := total_inserted + batch_count;

    insert into public.project_events (
      project_id, schema_version, event_key, event_type, entity_type, entity_id, actor_id,
      source, importance, summary, before_state, after_state, metadata, confidence, occurred_at, is_historical_import
    )
    select
      r.project_id, 1, 'recovery:' || r.id || ':status:' || r.status::text || ':' ||
        md5(r.updated_at::text || r.status::text),
      'recovery.status_changed', 'recovery_plans', r.id, r.created_by,
      'system', 'high', 'Recovery plan status changed to ' || r.status::text,
      '{}'::jsonb,
      jsonb_build_object('status', r.status),
      jsonb_build_object('import_kind', 'existing_artifact'), 100, r.updated_at, true
    from public.recovery_plans r
    where r.status <> 'proposed'
    on conflict (event_key) do nothing;
    get diagnostics batch_count = row_count;
    total_inserted := total_inserted + batch_count;
  end if;

  if to_regclass('public.goal_simulations') is not null then
    insert into public.project_events (
      project_id, schema_version, event_key, event_type, entity_type, entity_id, actor_id,
      source, importance, summary, after_state, metadata, confidence, occurred_at, is_historical_import
    )
    select
      s.project_id, 1, 'simulation:' || s.id || ':created', 'simulation.created', 'goal_simulations', s.id, s.created_by,
      'system', 'high', 'Goal simulation created',
      jsonb_build_object('scenario_name', s.scenario_name),
      jsonb_build_object('import_kind', 'existing_artifact'), 100, s.created_at, true
    from public.goal_simulations s
    on conflict (event_key) do nothing;
    get diagnostics batch_count = row_count;
    total_inserted := total_inserted + batch_count;
  end if;

  if to_regclass('public.ai_runs') is not null then
    insert into public.project_events (
      project_id, schema_version, event_key, event_type, entity_type, entity_id, actor_id,
      source, importance, summary, after_state, metadata, confidence, occurred_at, is_historical_import
    )
    select
      a.project_id, 1, 'ai_run:' || a.id || ':' || a.status::text, 'ai_run.' || a.status::text, 'ai_runs', a.id, a.user_id,
      'ai', 'normal', 'AI ' || replace(a.capability::text, '_', ' ') || ' run ' || a.status::text,
      jsonb_strip_nulls(jsonb_build_object(
        'capability', a.capability, 'status', a.status, 'prompt_version', a.prompt_version
      )),
      jsonb_build_object('import_kind', 'existing_artifact'), 100, coalesce(a.completed_at, a.created_at), true
    from public.ai_runs a
    where a.project_id is not null and a.status in ('completed', 'failed')
    on conflict (event_key) do nothing;
    get diagnostics batch_count = row_count;
    total_inserted := total_inserted + batch_count;
  end if;

  if to_regclass('public.momentum_flow_proposals') is not null then
    insert into public.project_events (
      project_id, schema_version, event_key, event_type, entity_type, entity_id, actor_id,
      source, importance, summary, after_state, metadata, confidence, occurred_at, is_historical_import
    )
    select
      m.project_id, 1, 'momentum_flow:' || m.id || ':proposed',
      'momentum_flow.proposed', 'momentum_flow_proposals', m.id, m.user_id, 'system',
      'normal', 'Momentum Flow proposed',
      jsonb_build_object('status', 'proposed', 'schedule_date', m.schedule_date, 'confidence', m.confidence),
      jsonb_build_object('import_kind', 'existing_artifact'), 100, m.created_at, true
    from public.momentum_flow_proposals m
    where m.project_id is not null
    on conflict (event_key) do nothing;
    get diagnostics batch_count = row_count;
    total_inserted := total_inserted + batch_count;

    insert into public.project_events (
      project_id, schema_version, event_key, event_type, entity_type, entity_id, actor_id,
      source, importance, summary, before_state, after_state, metadata, confidence, occurred_at, is_historical_import
    )
    select
      m.project_id, 1, 'momentum_flow:' || m.id || ':applied',
      'momentum_flow.applied', 'momentum_flow_proposals', m.id, m.user_id, 'system',
      'high', 'Momentum Flow applied',
      jsonb_build_object('status', 'proposed'),
      jsonb_build_object('status', 'applied', 'schedule_date', m.schedule_date, 'confidence', m.confidence),
      jsonb_build_object('import_kind', 'existing_artifact'), 100, coalesce(m.applied_at, m.updated_at), true
    from public.momentum_flow_proposals m
    where m.project_id is not null and m.status = 'applied'
    on conflict (event_key) do nothing;
    get diagnostics batch_count = row_count;
    total_inserted := total_inserted + batch_count;
  end if;

  if to_regclass('public.momentum_flow_sessions') is not null then
    insert into public.project_events (
      project_id, schema_version, event_key, event_type, entity_type, entity_id, actor_id,
      source, importance, summary, after_state, metadata, confidence, occurred_at, is_historical_import
    )
    select
      s.project_id, 1,
      'momentum_session:' || s.id || ':' || s.status::text || ':' ||
        md5(s.updated_at::text || s.status::text || s.start_at::text || s.end_at::text),
      'momentum_session.' || s.status::text, 'momentum_flow_sessions', s.id, s.user_id, 'system',
      case when s.status = 'completed' then 'high' else 'normal' end,
      'Momentum session ' || s.status::text,
      jsonb_build_object('status', s.status, 'start_at', s.start_at, 'end_at', s.end_at),
      jsonb_build_object('import_kind', 'existing_artifact'), 100, s.updated_at, true
    from public.momentum_flow_sessions s
    where s.project_id is not null and s.status in ('locked', 'completed', 'skipped')
    on conflict (event_key) do nothing;
    get diagnostics batch_count = row_count;
    total_inserted := total_inserted + batch_count;
  end if;

  return jsonb_build_object('schema_version', 1, 'inserted', total_inserted);
end;
$$;

revoke all on function public.import_project_history_v1() from public, anon, authenticated;
grant execute on function public.import_project_history_v1() to service_role;

select pg_notify('pgrst', 'reload schema');
