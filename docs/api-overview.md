# API Overview

All implemented APIs are HTTP JSON endpoints under `apps/web/src/app/api`.

## Auth model

Most routes require a signed-in Supabase user. Unauthenticated requests generally return:

```json
{ "error": "Unauthorized" }
```

## Route groups

### Projects

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `PATCH /api/projects/:id`
- `DELETE /api/projects/:id`
- `GET /api/projects/:id/tasks`
- `POST /api/projects/:id/tasks`
- `GET /api/projects/:id/members`
- `POST /api/projects/:id/members`
- `DELETE /api/projects/:id/members/:userId`

### Execution and health

- `GET /api/momentum/execution-score`
- `GET /api/projects/:id/execution-score`
- `GET /api/planner/today`
- `GET /api/momentum/brief`

### Project memory and intelligence

- `POST /api/projects/:id/intelligence`
- `GET /api/projects/:id/intelligence/timeline`
- `GET /api/projects/:id/decisions`
- `POST /api/projects/:id/decisions`

### Recovery and simulation

- `GET /api/projects/:id/recovery-plans`
- `POST /api/projects/:id/recovery-plans`
- `POST /api/ai/simulate-goal`

### AI planning helpers

- `POST /api/ai/extract-tasks`
- `POST /api/ai/work-breakdown`
- `GET /api/ai/runs/:id`

### Momentum flow / execution planning

- `GET /api/momentum-flow/today`
- `POST /api/momentum-flow/proposals`
- `POST /api/momentum-flow/proposals/:id/apply`
- `POST /api/momentum-flow/proposals/:id/explain`
- `PATCH /api/momentum-flow/sessions/:id`

### Tasks and supporting lookups

- `GET /api/tasks/:id`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `GET /api/tasks/:id/risk`
- `GET /api/users/search`

## Permission model at a glance

- project members can read most project-scoped data
- project owners mutate project metadata
- project owners/admins manage members
- project write roles (`owner`, `admin`, `editor`) create and update tasks
- simulations are member-readable
- AI run details are readable by the run owner or a member of the linked project

## Error conventions

Common status patterns:

- `400` invalid input
- `401` no session
- `403` forbidden
- `404` missing project, task, proposal, or run
- `409` conflict for state-dependent actions
- `500` unexpected server or database failure

See [rest-api-reference.md](rest-api-reference.md) for the current contracts and request shapes.
