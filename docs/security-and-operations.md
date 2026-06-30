# Security And Operations

## Security model

### Authentication

- Supabase Auth is the identity provider.
- The app reads the current user from server-side cookies.
- Google OAuth and email/password auth are both implemented.

### Authorization

Authorization is enforced in two places:

1. application-level checks in `apps/web/src/lib/momentum/authz.ts`
2. Supabase RLS and helper functions in SQL

This is important because many handlers use the service-role client after first validating the user and role.

### Service-role usage

`createAdminClient()` bypasses RLS and must stay server-only.

Use it only after:

- checking the current session
- checking project or task access

### AI data handling

AI-backed capabilities persist structured run metadata in:

- `ai_runs`
- `ai_run_citations`

This provides traceability for:

- daily briefs
- Ask Momentum answers
- simulations
- execution-plan explanations
- extraction and work-breakdown flows

## Operational notes

### Main app

The maintained application is `apps/web`.

Root scripts currently support:

- `npm run dev:web`
- `npm run build:web`
- `npm run start:web`

### Database migrations

Database changes are represented as SQL files under `supabase/patches`.

When adding or changing behavior, keep these aligned:

- table definitions
- RLS policies
- helper functions
- RPC functions used by event-backed mutations

### Testing

The web app currently uses:

- `vitest` for unit tests
- `next lint`
- `next build`

### Leftover sync-server artifact

The repository still contains `apps/sync-server`, but it is not wired as a maintained workspace app in the current root `package.json`.

Treat it as leftover or archival material unless it is intentionally restored with:

- source files
- its own package manifest
- active scripts
- updated docs

## Practical contributor rules

- never expose `SUPABASE_SERVICE_KEY` to the browser
- keep authz changes aligned with SQL helpers and RLS
- prefer documenting only routes and features backed by current source
- remove stale product references when the implementation is retired
