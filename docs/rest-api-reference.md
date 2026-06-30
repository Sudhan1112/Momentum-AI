# REST API Reference

This reference documents the APIs that are implemented today.

## Conventions

- Base path: `/api`
- Content type: JSON
- Auth: Supabase session cookies
- Error shape: `{ "error": string }`

## Projects

### `GET /api/projects`

Returns all projects the current user owns or belongs to.

### `POST /api/projects`

Creates a project.

Request fields:

- `title` required
- `description` optional
- `target_deadline` optional
- `goal_summary` optional
- `execution_target_score` optional

Returns `201`.

### `GET /api/projects/:id`

Returns one project plus `current_user_role`.

### `PATCH /api/projects/:id`

Owner only.

Accepted fields:

- `title`
- `description`
- `target_deadline`
- `goal_summary`
- `execution_target_score`
- `status`
- `change_reason` optional event-journal reason

### `DELETE /api/projects/:id`

Owner only. Returns `{ "success": true }`.

## Project tasks

### `GET /api/projects/:id/tasks`

Returns:

```json
{
  "role": "owner",
  "tasks": []
}
```

### `POST /api/projects/:id/tasks`

Write role required.

Accepted fields:

- `title` required
- `description`
- `status`
- `priority`
- `assignee_id`
- `due_at`
- `started_at`
- `estimate_minutes`
- `blocked_reason`

Returns `201`.

## Tasks

### `GET /api/tasks/:id`

Returns the task, linked project summary, and `current_user_role`.

### `PATCH /api/tasks/:id`

Write role required.

Accepted fields:

- all create-task fields
- `actual_minutes`
- `completed_at`
- `change_reason`

### `DELETE /api/tasks/:id`

Write role required.

Optional query param:

- `reason`

Returns `{ "success": true }`.

### `GET /api/tasks/:id/risk`

Returns the computed risk score for a task and persists the latest snapshot.

## Members

### `GET /api/projects/:id/members`

Member read access required.

Returns:

```json
{
  "role": "admin",
  "members": []
}
```

### `POST /api/projects/:id/members`

Owner/admin only.

Request fields:

- `user_id`
- `role`

Returns `201`.

### `DELETE /api/projects/:id/members/:userId`

Owner/admin only.

Returns `{ "success": true }`.

## Execution and planner

### `GET /api/momentum/execution-score`

Returns workspace execution score and health.

### `GET /api/projects/:id/execution-score`

Returns:

- `execution_score`
- `health`
- `recovery_eligibility`

### `GET /api/planner/today`

Returns the deterministic daily planner payload used by `/planner`.

### `GET /api/momentum/brief`

Returns the Momentum daily brief used by `/momentum`.

The response may be AI-backed or fallback-driven depending on model availability.

## Recovery and simulation

### `GET /api/projects/:id/recovery-plans`

Returns recovery plans for a project.

### `POST /api/projects/:id/recovery-plans`

Write role required.

Optional request field:

- `force: true` to generate an exploratory plan even when the project is healthy

Returns `201`.

### `POST /api/ai/simulate-goal`

Project membership required.

Accepted fields:

- `project_id` required
- `target_deadline`
- `daily_work_hours`
- `extra_daily_hours`
- `delay_task_id`
- `delay_days`
- `shift_milestone_days`
- `remove_completed_tasks`

Returns `201`.

## Project intelligence

### `POST /api/projects/:id/intelligence`

Member access required.

Request fields:

- `question` required

Returns an Ask Momentum answer with evidence and AI/fallback metadata.

### `GET /api/projects/:id/intelligence/timeline`

Member access required.

Optional query param:

- `filter` one of `all`, `tasks`, `recovery`, `simulation`, `ai`, `decisions`

### `GET /api/projects/:id/decisions`

Member access required.

Returns accepted decision records with linked evidence.

### `POST /api/projects/:id/decisions`

Write role required.

Accepted fields:

- `title`
- `decision`
- `reason`
- `category`
- `importance`
- `evidence_event_ids`

Returns `201`.

## AI helper routes

### `POST /api/ai/extract-tasks`

If `project_id` is supplied, write role is required for that project.

Accepted fields:

- `text`
- `project_id`
- `document_id`

Note: `document_id` is still accepted by the route, but the collaborative documents feature is retired from the current product.

### `POST /api/ai/work-breakdown`

Write role required.

Accepted fields:

- `project_id`
- `goal`

### `GET /api/ai/runs/:id`

Readable by the AI run owner or a member of the linked project.

Returns the run plus stored citations.

## Momentum flow / execution plan

### `GET /api/momentum-flow/today`

Optional query param:

- `project_id`

Returns the latest execution plan for today if one exists.

### `POST /api/momentum-flow/proposals`

Optional request fields:

- `project_id`
- `schedule_date`

Returns `201`.

### `POST /api/momentum-flow/proposals/:id/apply`

Request field:

- `session_ids` optional array of selected session ids

Important: this applies stored proposal/session data, not the newer advisory-only execution-intelligence plans.

### `POST /api/momentum-flow/proposals/:id/explain`

Returns:

- `explanation`
- `ai_run_id`
- `mode`
- `fallback_reason`

### `PATCH /api/momentum-flow/sessions/:id`

Accepted fields:

- `start_at`
- `end_at`
- `status` one of `scheduled`, `locked`, `completed`, `skipped`
- `is_locked`

## Supporting route

### `GET /api/users/search?q=...`

Returns up to 5 matching profiles by email substring for authenticated users.
