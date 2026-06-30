# Contributing

## Before you change code

Read these first:

1. [getting-started.md](getting-started.md)
2. [architecture.md](architecture.md)
3. [data-model.md](data-model.md)
4. [api-overview.md](api-overview.md)

## Project layout

- `apps/web` active Next.js application
- `supabase` schema and patch files
- `docs` maintained documentation

## Expectations for changes

- keep docs aligned with implemented behavior
- remove stale feature references instead of documenting planned work as if it exists
- keep API docs consistent with route handlers
- keep SQL/RLS helpers consistent with authz logic

## Verification

Run these from the repo root:

```bash
npm run test --workspace=apps/web
npm run lint --workspace=apps/web
npm run build --workspace=apps/web
```

## If you touch Supabase SQL

Update the relevant files under `supabase/patches` and make sure any documentation about:

- tables
- enums
- helper functions
- RPC functions
- retired features

still matches the codebase.

## If you touch APIs

Update:

- `docs/api-overview.md`
- `docs/rest-api-reference.md`

## If you touch product behavior

Update:

- `docs/architecture.md`
- `docs/data-model.md`
- `docs/troubleshooting.md`

Only document features that are actually implemented in source and database patches.
