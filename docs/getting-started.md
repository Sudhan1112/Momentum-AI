# Getting Started

Momentum AI is currently implemented as a Supabase-backed Next.js app in `apps/web`.

## Requirements

- Node.js 18+
- npm
- A Supabase project

## Install

```bash
npm install
```

## Environment

Copy the values from [`.env.example`](../.env.example) into `apps/web/.env.local`.

Required for the web app:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`

Optional but used by AI-backed routes:

- `GEMINI_API_KEY`
- `MOMENTUM_AI_MODEL`

Notes:

- The app supports email/password auth and Google OAuth.
- OAuth redirects return through `apps/web/src/app/auth/callback/route.ts`.
- `NEXT_PUBLIC_SYNC_SERVER_URL` still exists in `.env.example`, but the current workspace does not expose an active sync-server app through npm workspaces.

## Database setup

Run the SQL in this order on a fresh Supabase project:

1. `supabase/schema.sql`
2. The files in `supabase/patches/`

Important patches include:

- project and task tables
- project role helpers and RLS helpers
- project event journal RPCs
- recovery plans
- goal simulations
- AI run logging
- momentum flow proposal/session storage
- `remove_documents_feature.sql` to remove the retired documents feature

## Run locally

```bash
npm run dev:web
```

The app runs from `apps/web`.

## Verification

```bash
npm run test --workspace=apps/web
npm run lint --workspace=apps/web
npm run build --workspace=apps/web
```
