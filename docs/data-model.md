# Data Model

## Core entities

### Identity

- `profiles`

### Projects and access

- `projects`
- `project_members`

### Work management

- `tasks`
- `task_risk_scores`

### AI and planning

- `ai_runs`
- `ai_run_citations`
- `goal_simulations`
- `recovery_plans`
- `momentum_flow_proposals`
- `momentum_flow_sessions`
- `user_capacity_profiles`

### Project memory

- `project_events`

## Current enums in use

### App roles

- `viewer`
- `commenter`
- `editor`
- `admin`
- `owner`

### Project status

- `active`
- `paused`
- `completed`
- `archived`

### Task status

- `backlog`
- `todo`
- `in_progress`
- `blocked`
- `done`
- `cancelled`

### Task priority

- `low`
- `medium`
- `high`
- `urgent`

### AI capabilities

- `extract_tasks`
- `work_breakdown`
- `blocker_detection`
- `morning_brief`
- `recovery_plan`
- `goal_simulation`
- `risk_explain`
- `momentum_flow`

## Role model

Ownership is determined by `projects.owner_id`.

Membership rows in `project_members` provide additional access for:

- `admin`
- `editor`
- `commenter`
- `viewer`

In application code:

- `owner`, `admin`, and `editor` are treated as write roles
- `owner` and `admin` are treated as admin roles
- project metadata mutation is currently owner-only

## Project event journal

The event journal is a first-class part of the data model, not just analytics.

It records events such as:

- project creation and updates
- task lifecycle changes
- deadline and priority changes
- recovery generation
- simulation creation
- AI run completion or failure
- decision acceptance

This history drives:

- timeline rendering
- evidence-backed decisions
- Ask Momentum evidence ranking

## Mutation pattern

Project and task writes often go through Supabase RPCs instead of direct row updates:

- `create_project_with_events`
- `update_project_with_events`
- `create_task_with_events`
- `update_task_with_events`
- `delete_task_with_events`
- `insert_project_event_specs`

That keeps the canonical row state and the event journal aligned.

## RLS and helper functions

The schema uses helper functions to avoid recursive policy logic, including:

- `is_project_member`
- `is_project_owner`
- `has_project_write_role`
- `has_project_admin_role`

These helpers back RLS across projects, tasks, recovery plans, simulations, and related records.

## Retired document model

The former documents feature has been explicitly removed by `supabase/patches/remove_documents_feature.sql`.

Some legacy-compatible field names still appear in isolated places, such as citation source enums and `document_id` in task extraction inputs, but documents are not part of the active product model anymore.
