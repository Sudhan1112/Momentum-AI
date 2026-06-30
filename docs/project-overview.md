# Momentum AI

## Complete Project Overview

**Project type:** AI-assisted project planning and execution management platform  
**Primary application:** Web application  
**Application location:** `apps/web`  
**Core technologies:** Next.js, React, TypeScript, Supabase, PostgreSQL, Tailwind CSS, and Google Gemini  
**Document status:** Based on the currently implemented repository  
**Last updated:** June 30, 2026

---

## 1. Executive Summary

Momentum AI is an intelligent project management workspace designed to help individuals and teams convert project goals into structured, prioritized, and measurable work. The application combines conventional project management functions, such as projects, tasks, deadlines, roles, and daily planning, with deterministic execution analytics and optional AI assistance.

The central idea is that managing work should involve more than storing task lists. Momentum AI continuously interprets the state of a workspace by measuring completion, overdue pressure, current activity, recent velocity, task risk, available capacity, and project history. It then presents this information through execution scores, health indicators, daily priorities, recovery plans, goal simulations, and evidence-backed project intelligence.

The current implementation is a server-rendered Next.js application backed by Supabase Authentication and PostgreSQL. Application APIs are implemented as Next.js route handlers. Domain logic is organized into dedicated services for projects, tasks, planning, risk, execution scoring, simulations, recovery, project memory, and AI capabilities. Google Gemini is used for selected generative features, while deterministic fallback behavior keeps core workflows usable when an AI model is not configured or available.

Momentum AI currently supports:

- user authentication through email/password and Google OAuth
- project portfolio creation and management
- role-based project membership
- task creation, updates, deletion, prioritization, estimates, deadlines, and status tracking
- workspace-level and project-level execution scoring
- deterministic task-risk analysis
- a daily planner with a recommended next action
- workspace and project health classification
- project recovery-plan generation
- goal-completion simulation
- project event history, decisions, and evidence-backed intelligence
- AI-assisted task extraction, work breakdown, morning briefs, and execution-plan explanations
- structured logging of AI runs and their supporting citations

The former collaborative documents feature is not part of the current product. Its database objects have been explicitly removed, and it is excluded from this overview.

---

## 2. Problem Statement

Traditional project management tools are effective at recording tasks, but they often leave users to answer the most important execution questions manually:

- What should be worked on next?
- Which task is most likely to cause delay?
- Is the project progressing at a healthy rate?
- Can the current goal still be completed by its deadline?
- What changed in the project, and why was a decision made?
- How should a delayed project be recovered?

These questions require users to interpret deadlines, task status, workload, recent progress, blockers, and historical context across multiple screens. This creates cognitive overhead and makes task lists increasingly difficult to use as projects grow.

Momentum AI addresses this problem by treating project data as an active execution model. It transforms task and event data into practical guidance while preserving traceability. Deterministic calculations provide stable metrics, and AI is used where natural-language interpretation or structured generation adds value.

---

## 3. Project Objectives

The implemented system has the following objectives:

1. Provide a single workspace for creating, organizing, and monitoring projects and tasks.
2. Calculate understandable execution and risk metrics from current project data.
3. Prioritize daily work using deadlines, urgency, task state, and project context.
4. Help users evaluate whether a goal is achievable under current capacity and schedule constraints.
5. Generate practical recovery guidance when execution becomes unhealthy.
6. Preserve a project event journal so that recommendations and decisions can be tied to evidence.
7. Apply role-based access controls consistently in the application and database.
8. Keep important planning workflows operational even when the external AI model is unavailable.

---

## 4. Scope of the Implemented Product

### 4.1 User-Facing Pages

The application exposes the following primary pages:

| Route | Purpose |
| --- | --- |
| `/` | Execution home and workspace overview |
| `/projects` | Searchable project portfolio |
| `/projects/[id]` | Individual project workspace, tasks, timeline, and project intelligence |
| `/planner` | Daily planner and recommended next action |
| `/momentum` | Workspace execution intelligence and health |
| `/login` | Email/password and Google OAuth entry point |

### 4.2 Project Portfolio

Authenticated users can create projects and view projects they own or have joined. A project stores its title, description, status, target deadline, ownership information, and timestamps. Supported project states are `active`, `paused`, `completed`, and `archived`.

Project owners control project metadata and deletion. Owners and administrators can manage members. Project members can access project information according to their assigned role.

### 4.3 Task Management

Tasks belong to projects and can contain:

- title and description
- status
- priority
- due date
- time estimate
- blocked reason
- completion timestamp
- project and creation metadata

Supported task states are `backlog`, `todo`, `in_progress`, `blocked`, `done`, and `cancelled`. Priorities are `low`, `medium`, `high`, and `urgent`.

Task writes pass through validation and authorization services. Important mutations also update the project event journal so the latest row state and historical record remain aligned.

### 4.4 Daily Planner

The daily planner gathers tasks from all projects accessible to the current user and organizes them into:

- overdue work
- work due today
- active work already in progress
- blocked work

It also selects a recommended next action. Tasks are ordered using deterministic rules:

1. overdue tasks first
2. tasks due today
3. priority from urgent to low
4. active status, with in-progress work favored
5. earliest due date
6. most recently updated task

Blocked work is excluded from the preferred next action when actionable work exists. The planner also creates a project pulse for each project and a short daily narrative based on overdue, blocked, and due-today counts.

### 4.5 Execution Score

Momentum AI calculates a score from 0 to 100 at both project and workspace level. The score is the sum of four components:

| Component | Maximum | Measurement |
| --- | ---: | --- |
| Completion | 35 | Ratio of completed tasks to all non-cancelled tasks |
| Overdue control | 30 | Proportion of open tasks that are not overdue |
| Active flow | 15 | Whether an appropriate number of tasks are currently in progress |
| Current velocity | 20 | Tasks completed during the previous seven days relative to current workload |

The result includes component explanations, task totals, open and overdue counts, recently completed tasks, average risk, and the five highest-risk tasks. Scores are interpreted as strong, steady, needing attention, or critical.

### 4.6 Task Risk Analysis

Every open task can be assigned a deterministic risk score. The score considers:

- due-date proximity
- current task status
- overdue duration
- overall project completion rate

Blocked tasks, overdue tasks, tasks close to their due date, and tasks in projects with low completion rates receive higher risk contributions. Closed tasks receive a risk score of zero.

Risk is classified as:

| Score | Level |
| --- | --- |
| Below 0.30 | Low |
| 0.30 to below 0.55 | Medium |
| 0.55 to below 0.75 | High |
| 0.75 and above | Critical |

The service returns both a normalized score and a 0-100 score, a confidence value, contributing factors, and a plain-language explanation.

### 4.7 Workspace Health

The health service translates execution and risk information into one of three states:

- **Healthy**
- **Needs Attention**
- **Critical**

A workspace or project becomes critical when conditions such as a very low execution score, multiple critical risks, a high ratio of risky open tasks, or several overdue tasks are present. Less severe risk or overdue pressure produces the Needs Attention state. Each result contains the reasons for the classification.

### 4.8 Recovery Planning

Recovery planning is available for project members with write permission. It uses project details, task state, execution score, remaining workload, project deadline, recent velocity, and identified risk to produce a recovery proposal.

Recovery confidence is computed from:

- expected execution-score improvement
- recently completed work
- days remaining
- remaining workload relative to assumed capacity
- overdue pressure

Recovery plans are persisted and can be retrieved for a project. State-dependent conflicts are returned when a new recovery action would contradict the current project state unless the request explicitly allows a forced operation.

### 4.9 Goal Simulation

Goal simulation estimates the probability of completing a proposed goal under a selected schedule and capacity. The probability calculation combines:

- current execution score
- remaining work compared with available time
- schedule change
- overdue task count
- blocked task count
- high and critical risks
- current health state
- daily capacity

The calculation starts from the current execution score with a baseline adjustment, then applies penalties or bonuses. Simulations are stored in the database so results can be inspected later and linked to project history.

### 4.10 Project Memory and Intelligence

Momentum AI maintains a structured `project_events` journal. It records significant activity such as:

- project creation and updates
- task creation, updates, completion, and deletion
- deadline and priority changes
- recovery-plan generation
- goal simulations
- AI run completion or failure
- accepted decisions

The event journal supports project timelines, decision records, evidence selection, and Ask Momentum responses. This gives the intelligence layer a traceable source of project context instead of relying only on the latest database state.

### 4.11 AI-Assisted Capabilities

The implemented AI capability set includes:

- task extraction from supplied text
- work-breakdown generation
- morning brief generation
- goal-simulation support
- risk explanation prompts
- recovery planning
- momentum-flow or execution-plan generation and explanation
- evidence-backed project intelligence

AI execution follows a shared pattern:

1. Validate the signed-in user and requested scope.
2. Gather deterministic project, task, score, and event data.
3. Build a structured model context.
4. Select a versioned prompt.
5. Call Google Gemini when configured.
6. Normalize and validate the model output.
7. Use deterministic fallback output when the model is unavailable.
8. Store run metadata and citations when applicable.

This design prevents AI availability from becoming a single point of failure for the main planning experience.

---

## 5. System Architecture

Momentum AI follows a layered web architecture:

```text
User Interface
    |
    v
Next.js App Router and Server Components
    |
    v
Next.js API Route Handlers
    |
    v
Momentum Domain Services
    |                   |
    v                   v
Supabase/PostgreSQL   Gemini AI
```

### 5.1 Presentation Layer

The presentation layer is implemented with Next.js 14, React 18, TypeScript, Tailwind CSS, and reusable UI components. Pages live under `apps/web/src/app`. The interface communicates with server route handlers for protected data and mutations.

### 5.2 API Layer

API endpoints are Next.js route handlers under `apps/web/src/app/api`. A typical request:

1. reads the Supabase session from server-side cookies
2. validates input
3. checks project, task, or AI-run access
4. invokes a domain service
5. returns a JSON response or normalized error

Common response codes are:

| Status | Meaning |
| ---: | --- |
| 400 | Invalid request data |
| 401 | User is not authenticated |
| 403 | User lacks the required role |
| 404 | Requested resource does not exist |
| 409 | Current state conflicts with the requested action |
| 500 | Unexpected server or database failure |

### 5.3 Domain Layer

Business logic lives under `apps/web/src/lib/momentum`. Major modules include:

| Module | Responsibility |
| --- | --- |
| `projects/` | Project CRUD and membership |
| `tasks/` | Task CRUD, validation, and event-backed mutations |
| `planner/` | Daily task organization and next-action selection |
| `memory/` | Event journal, timeline, decisions, and intelligence |
| `ai/` | AI context, prompts, gateway, execution, rate limiting, and logging |
| `scheduler/` | Execution-plan and momentum-flow logic |
| `execution-score.ts` | Workspace and project score calculation |
| `risk-scorer.ts` | Explainable task-risk calculation |
| `health-snapshot.ts` | Health-level classification |
| `recovery-service.ts` | Recovery-plan generation and persistence |
| `simulation-service.ts` | Goal simulation and persistence |

### 5.4 Data Layer

Supabase provides authentication, PostgreSQL storage, row-level security, and database functions. Privileged server operations use a service-role client only after application-level session and role validation.

### 5.5 Repository Structure

```text
Momentum-AI/
|-- apps/
|   |-- web/                  Active Next.js application
|   `-- sync-server/          Inactive leftover artifact
|-- docs/                     Project documentation
|-- supabase/
|   |-- schema.sql            Base database schema
|   `-- patches/              Incremental database changes
|-- package.json              Workspace scripts
`-- README.md                 Repository introduction
```

The root workspace currently maintains `apps/web`. The `apps/sync-server` directory is not connected to an active package manifest or root runtime script and is not part of the implemented architecture.

---

## 6. Database Design

### 6.1 Core Tables

| Table | Purpose |
| --- | --- |
| `profiles` | Application profile linked to authenticated identity |
| `projects` | Project metadata, status, owner, and deadline |
| `project_members` | Project membership and assigned role |
| `tasks` | Project work items and execution state |
| `task_risk_scores` | Persisted task-risk snapshots |
| `project_events` | Append-oriented project history and evidence |
| `recovery_plans` | Generated project recovery proposals |
| `goal_simulations` | Stored schedule and completion simulations |
| `ai_runs` | AI request, capability, status, and result metadata |
| `ai_run_citations` | Evidence associated with AI output |
| `momentum_flow_proposals` | Stored execution proposals |
| `momentum_flow_sessions` | User interaction state for proposals |
| `user_capacity_profiles` | Capacity information used in scheduling |

### 6.2 Event-Backed Mutations

Important project and task changes use PostgreSQL functions such as:

- `create_project_with_events`
- `update_project_with_events`
- `create_task_with_events`
- `update_task_with_events`
- `delete_task_with_events`
- `insert_project_event_specs`

These functions keep the current record and its corresponding event history synchronized within the database operation.

### 6.3 Data Security

Row-level security uses helper functions including:

- `is_project_member`
- `is_project_owner`
- `has_project_write_role`
- `has_project_admin_role`

These helpers support consistent access rules across projects, tasks, recovery plans, simulations, and related project data.

---

## 7. Authentication and Authorization

Supabase Auth provides identity management. The application supports:

- email and password authentication
- Google OAuth
- server-side cookie-based session retrieval
- an OAuth callback route for completing sign-in

Project access uses five roles:

| Role | Read project | Write tasks | Manage members | Edit/delete project |
| --- | :---: | :---: | :---: | :---: |
| Owner | Yes | Yes | Yes | Yes |
| Admin | Yes | Yes | Yes | No |
| Editor | Yes | Yes | No | No |
| Commenter | Yes | No | No | No |
| Viewer | Yes | No | No | No |

Authorization is enforced twice:

1. application checks in `src/lib/momentum/authz.ts`
2. PostgreSQL row-level security and helper functions

The server-side Supabase service key bypasses row-level security and is therefore restricted to server code. Route handlers must authenticate the user and verify access before using privileged database operations.

---

## 8. REST API Summary

### 8.1 Projects and Members

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `PATCH /api/projects/:id`
- `DELETE /api/projects/:id`
- `GET /api/projects/:id/members`
- `POST /api/projects/:id/members`
- `DELETE /api/projects/:id/members/:userId`

### 8.2 Tasks

- `GET /api/projects/:id/tasks`
- `POST /api/projects/:id/tasks`
- `GET /api/tasks/:id`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `GET /api/tasks/:id/risk`

### 8.3 Execution and Planning

- `GET /api/momentum/execution-score`
- `GET /api/projects/:id/execution-score`
- `GET /api/planner/today`
- `GET /api/momentum/brief`

### 8.4 Intelligence, Decisions, and Recovery

- `POST /api/projects/:id/intelligence`
- `GET /api/projects/:id/intelligence/timeline`
- `GET /api/projects/:id/decisions`
- `POST /api/projects/:id/decisions`
- `GET /api/projects/:id/recovery-plans`
- `POST /api/projects/:id/recovery-plans`

### 8.5 AI and Simulation

- `POST /api/ai/extract-tasks`
- `POST /api/ai/work-breakdown`
- `POST /api/ai/simulate-goal`
- `GET /api/ai/runs/:id`

### 8.6 Momentum Flow

- `GET /api/momentum-flow/today`
- `POST /api/momentum-flow/proposals`
- `POST /api/momentum-flow/proposals/:id/apply`
- `POST /api/momentum-flow/proposals/:id/explain`
- `PATCH /api/momentum-flow/sessions/:id`

### 8.7 Supporting Lookup

- `GET /api/users/search`

The detailed request and response contracts are maintained in `docs/rest-api-reference.md`.

---

## 9. End-to-End System Workflow

A typical project workflow is:

1. A user signs in through Supabase Auth.
2. The user creates a project and optionally adds project members.
3. Tasks are created manually or generated from text using task extraction or work breakdown.
4. Task mutations update both the task tables and the project event journal.
5. The execution service calculates progress, overdue control, activity, and velocity.
6. The risk service evaluates each task and identifies the highest risks.
7. The daily planner recommends the most actionable task.
8. The health service classifies the project or workspace.
9. If delivery is under pressure, the user can generate a recovery plan or run a goal simulation.
10. Project intelligence uses event evidence to explain changes, decisions, and recommended action.
11. AI run metadata and citations are stored when an AI-backed capability is executed.

---

## 10. Reliability and Explainability

Momentum AI separates deterministic decisions from generative assistance.

Deterministic services calculate:

- execution score
- task risk
- workspace health
- planner ordering
- recovery confidence
- simulation probability

These calculations are reproducible and include explanatory factors. AI is used for language generation, task interpretation, work decomposition, and richer recommendations. The system first builds structured context from validated application data and falls back to deterministic output if the model fails.

This approach improves:

- reliability, because essential planning does not depend entirely on an external model
- explainability, because scores show their components
- auditability, because events, AI runs, and citations are stored
- testability, because core calculations can be evaluated without network calls

---

## 11. Testing and Quality Assurance

The web application uses:

- Vitest for unit tests
- Next.js ESLint rules for static quality checks
- TypeScript and the production Next.js build for integration and type validation

Current unit-test coverage targets important deterministic and intelligence behavior, including:

- date handling
- AI proposal normalization
- event-journal behavior
- Ask Momentum behavior
- project intelligence
- recovery triggers
- simulation probability
- execution intelligence
- momentum-flow readiness

The standard verification commands are:

```bash
npm run test --workspace=apps/web
npm run lint --workspace=apps/web
npm run build --workspace=apps/web
```

Manual release verification should also cover authentication, project and task CRUD, role permissions, planner output, execution scoring, recovery plans, simulations, timelines, AI fallbacks, and responsive page behavior.

---

## 12. Installation and Local Execution

### Requirements

- Node.js 18 or newer
- npm
- a Supabase project
- a Gemini API key for model-backed output

### Environment Variables

Required:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY
```

Optional AI configuration:

```text
GEMINI_API_KEY
MOMENTUM_AI_MODEL
```

### Setup

```bash
npm install
npm run dev:web
```

For a new Supabase environment, apply `supabase/schema.sql` first and then the SQL files under `supabase/patches`.

---

## 13. Current Implementation Boundaries

The following boundaries are important when evaluating the current repository:

- The collaborative documents and real-time document-editing product has been retired and is not an active feature.
- `apps/sync-server` is an inactive leftover directory and is not part of the maintained workspace or runtime.
- Gemini configuration is optional; AI-backed routes may return deterministic or limited fallback output without it.
- Momentum-flow generation uses the newer execution-intelligence service, while proposal application and session updates still use the existing momentum-flow storage service.
- Some legacy-compatible names, such as `document_id` in one task-extraction input, remain in isolated contracts but do not represent an active documents module.

These items are documented as implementation boundaries, not as available product functionality.

---

## 14. Conclusion

Momentum AI is an implemented project execution platform that combines structured work management with explainable analytics and carefully bounded AI assistance. Its main contribution is the conversion of ordinary project data into actionable execution guidance: what to do next, where risk is increasing, how healthy current delivery is, and what recovery action may improve the outcome.

The architecture supports this goal through a clear separation of interface, API, domain, data, and AI responsibilities. Supabase provides identity, relational storage, database functions, and row-level security. The event journal preserves project context, deterministic services provide reproducible decisions, and Gemini enriches selected workflows without controlling core system availability.

As implemented, the project demonstrates a practical approach to trustworthy AI-assisted productivity: model output is grounded in current project data, important recommendations remain explainable, access is role-controlled, and historical evidence is retained for later review.
