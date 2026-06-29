# Momentum AI

Momentum AI is an intelligent project management workspace for planning projects, scheduling tasks, monitoring delivery risk, and guiding execution with AI.

## Product surfaces

- Portfolio dashboard with execution and health metrics
- Searchable project portfolio
- Project task grid and Gantt timeline
- Daily work planner
- AI planning, recovery, simulation, and project memory
- Role-based project membership

## Local development

```bash
npm install
npm run dev:web
```

The web application lives in `apps/web`. Configure its Supabase and AI environment values in `apps/web/.env.local`.

## Verification

```bash
npm run test --workspace=apps/web
npm run lint --workspace=apps/web
npm run build --workspace=apps/web
```

Database changes are maintained under `supabase/patches`. The Documents feature was retired; `remove_documents_feature.sql` permanently removes its legacy database objects.
