# Troubleshooting

## Auth fails with `401 Unauthorized`

Checks:

- confirm `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- confirm the user is signed in
- confirm OAuth callback URL points to `/auth/callback`

Relevant code:

- `apps/web/src/lib/supabase/server.ts`
- `apps/web/src/app/auth/callback/route.ts`
- `apps/web/src/lib/momentum/authz.ts`

## Server routes fail with a missing service key error

Symptom:

- server-side route throws an error mentioning `SUPABASE_SERVICE_KEY`

Fix:

- set `SUPABASE_SERVICE_KEY` in `apps/web/.env.local`

Relevant code:

- `apps/web/src/lib/supabase/admin.ts`

## Project or task routes return `403 Forbidden`

Checks:

- confirm the user is the project owner or has a `project_members` row
- confirm the required role for the route

Common role rules:

- project update/delete: owner only
- member add/remove: owner or admin
- task create/update/delete: owner, admin, or editor
- timeline and simulation reads: any member

## AI routes fall back or return limited output

Checks:

- confirm `GEMINI_API_KEY` is present
- confirm model access works for `MOMENTUM_AI_MODEL`

Expected behavior:

- many AI features intentionally degrade to deterministic fallback output
- AI run metadata is still logged when a real run succeeds

Relevant areas:

- `apps/web/src/lib/momentum/ai/executor.ts`
- `apps/web/src/lib/momentum/ai/run-logger.ts`

## Task update rejects due dates

Symptom:

- task write returns a validation error for `due_at`

Cause:

- task due dates cannot be after the project deadline

Relevant code:

- `apps/web/src/lib/momentum/tasks/task-service.ts`

## Recovery plan creation returns a conflict

Symptom:

- route returns a conflict saying the project is healthy

Fix:

- send `force: true` to generate an exploratory recovery plan

Relevant code:

- `apps/web/src/app/api/projects/[id]/recovery-plans/route.ts`
- `apps/web/src/lib/momentum/recovery-service.ts`

## Momentum flow behavior seems inconsistent

Cause:

- generation/read paths use execution-intelligence services
- apply/update paths still operate on stored proposal/session records

Relevant code:

- `apps/web/src/lib/momentum/scheduler/execution-intelligence-service.ts`
- `apps/web/src/lib/momentum/scheduler/momentum-flow-service.ts`

## Old docs mention documents or realtime collaboration

That documentation is stale for the current product.

The active app is project/task execution management, not the retired collaborative documents system.
