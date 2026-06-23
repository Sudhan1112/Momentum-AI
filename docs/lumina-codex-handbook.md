# Lumina — Codex Implementation Handbook

> **Start here** for any Codex, Cursor, or contributor session implementing Lumina.  
> This handbook consolidates approved planning—no additional context required.

---

## Project overview

**Lumina** evolves **Lumina Write** (collaborative Google Docs–style editor) into an **AI Execution Workspace**.

| | |
| --- | --- |
| **North Star** | Momentum AI helps users finish meaningful work before deadlines fail |
| **Primary loop** | Execute → Risk awareness → Recovery → Completion |
| **Documents** | Deliverable surface—collab unchanged |
| **AI provider** | Google Gemini (Flash) via server Route Handlers |
| **Monorepo** | `apps/web`, `apps/sync-server`, `supabase/` |

**Live app:** https://lumina-write-editor.vercel.app/

---

## Existing architecture

### What exists today

| Component | Status | Doc |
| --- | --- | --- |
| Supabase Auth (Google + email) | ✅ | [lumina-write-existing-state.md](lumina-write-existing-state.md) |
| Documents + sharing + roles | ✅ | [data-model.md](data-model.md) |
| TipTap + Yjs + Socket.IO collab | ✅ | [architecture.md](architecture.md) |
| Comments, versions, access requests | ✅ | [rest-api-reference.md](rest-api-reference.md) |
| Dashboard (doc-centric) at `/` | ✅ → **will become** Execute Home |
| Projects, tasks, AI | ❌ Planned |

### Repo layout

```text
apps/web/src/
  app/           Next.js App Router + /api
  components/    UI (Editor, ShareModal, …)
  hooks/         useCollabEditor.ts — FROZEN
  lib/           supabase, http, api-route-errors

apps/sync-server/src/   — FROZEN (index, auth, yjsManager)

supabase/schema.sql + patches/
```

### Realtime rule

```text
Document body + presence  →  Socket.IO + Yjs  →  sync-server
Everything else         →  REST Route Handlers  →  Supabase
```

---

## Non-negotiable constraints

### Must preserve

- Supabase Auth (`lib/supabase/*`, `/login`, `/auth/callback`)
- Documents (CRUD, `yjs_state`)
- Collaborative editing (TipTap, Yjs, `useCollabEditor`)
- Socket.IO sync server
- Sharing, roles, access requests
- Comments, version history
- Presence / cursor colors
- Existing `/api/documents/**` response contracts
- Row Level Security patterns on document tables

### Must NOT

- Redesign the application from scratch
- Replace App Router + Route Handler architecture
- Remove or refactor collaborative editing core
- Introduce **Prisma** or **Drizzle**
- Introduce **Server Actions** (`"use server"`)
- Put AI or tasks on Socket.IO
- Expose `GEMINI_API_KEY` or service role key to browser
- Run destructive `schema.sql` on production databases
- Auto-apply AI mutations (`apply: true` is never default)

### Touch with extreme care

| File | Allowed |
| --- | --- |
| `app/page.tsx` | Migrate to Execute Home; move docs to `/documents` |
| `components/Editor.tsx` | Add single menu entry only (extract tasks) |
| `documents` table | Add nullable `project_id` only |

### Never touch (unless critical bugfix)

- `apps/sync-server/src/*`
- `hooks/useCollabEditor.ts`
- `components/editorExtensions.ts`
- `app/api/documents/**` (contract changes need explicit approval)
- `lib/base64.ts`

---

## Approved architecture decisions

| Decision | Choice |
| --- | --- |
| Evolution strategy | Additive; parallel execution domain |
| Database | Supabase Postgres; patches in `supabase/patches/` |
| API | Next.js 14 Route Handlers only |
| Authz | App-layer `lib/momentum/authz.ts` + RLS defense-in-depth |
| AI | Single Gemini Flash gateway; deterministic-first |
| AI mutations | Propose → user confirms (`apply: false` default) |
| Audit | `ai_runs` + `ai_run_citations` on every LLM call |
| Memory | `momentum_memory_entries`; no `yjs_state` in memory |
| Project roles | Reuse `app_role` enum |
| Home route | `/` = Execute Home; docs at `/documents` |
| Momentum UX | Ambient brief + side panel—not chatbot-first |
| Planner MVP | **Today only**—no week/calendar |
| Sprint order | AI in Sprint 3; Simulation before Recovery |
| Demo | Dedicated Sprint D with seed + cache |

---

## Documentation map

| Doc | When to read |
| --- | --- |
| [lumina-vision.md](lumina-vision.md) | Product why |
| [lumina-architecture.md](lumina-architecture.md) | System design |
| [lumina-database-architecture.md](lumina-database-architecture.md) | Tables, RLS, migration order |
| [lumina-api-architecture.md](lumina-api-architecture.md) | Routes, services, authz |
| [lumina-ui-architecture.md](lumina-ui-architecture.md) | Screens, flows, demo |
| [lumina-ai-architecture.md](lumina-ai-architecture.md) | Momentum AI (primary AI ref) |
| [lumina-mvp-scope.md](lumina-mvp-scope.md) | Must/should/defer |
| [lumina-implementation-roadmap.md](lumina-implementation-roadmap.md) | Sprints |
| [lumina-write-existing-state.md](lumina-write-existing-state.md) | Pre-Lumina snapshot |

**Legacy (still valid for documents/collab):**

| Doc | Purpose |
| --- | --- |
| [getting-started.md](getting-started.md) | Local setup |
| [architecture.md](architecture.md) | Yjs/Socket flows |
| [data-model.md](data-model.md) | Document roles |
| [rest-api-reference.md](rest-api-reference.md) | Document API contracts |
| [sync-server-api.md](sync-server-api.md) | Socket events |
| [troubleshooting.md](troubleshooting.md) | Debug |

---

## Build order

### Sprint sequence (approved)

```text
0 Foundation → 1 Projects/Tasks → 2 Execute Dashboard
→ 3 Momentum AI → 4 Risk/Scores/Health → 5 Simulation
→ 6 Recovery → 7 Polish (optional) → D Demo
```

### Database patches (apply in order)

1. `add_project_enums.sql`  
2. `add_project_rls_helpers.sql`  
3. `add_projects.sql`  
4. `add_project_members.sql`  
5. `add_tasks.sql`  
6. `add_documents_project_id.sql` (optional, Sprint 2)  
7. `add_memory_enums.sql`  
8. `add_momentum_memory_entries.sql`  
9. `add_ai_enums.sql`  
10. `add_ai_runs.sql`  
11. `add_ai_run_citations.sql`  
12. `add_task_risk_scores.sql`  
13. `add_workspace_health_snapshots.sql`  
14. `add_goal_simulations.sql`  
15. `add_recovery_enums.sql`  
16. `add_recovery_plans.sql`  

### API build order

1. `/api/projects/**`, `/api/tasks/**`  
2. `/api/planner/today`  
3. `/api/momentum/brief`, `/api/momentum/memory`, `/api/ai/work-breakdown`, `/api/ai/runs/[id]`  
4. Risk + execution-score + health routes  
5. `/api/ai/simulate-goal`  
6. Recovery routes  

### New code locations

```text
apps/web/src/
  types/
  lib/momentum/
  app/api/projects/
  app/api/tasks/
  app/api/planner/
  app/api/momentum/
  app/api/ai/
  app/projects/
  app/documents/
  app/onboarding/
  components/shell/
  components/execute/
  components/projects/
  components/tasks/
  components/momentum/
  components/recovery/
  components/simulation/
```

### Environment variables (new)

| Var | Where | Secret |
| --- | --- | --- |
| `GEMINI_API_KEY` | `apps/web` server | Yes |
| `MOMENTUM_AI_MODEL` | `apps/web` server | No |
| `CRON_SECRET` | internal routes (defer) | Yes |

Existing: `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_KEY`, `NEXT_PUBLIC_SYNC_SERVER_URL`

---

## Implementation conventions

### Route handlers

1. `requireSession()` → `401`  
2. `parseJsonObject(req)` for mutations  
3. `assertProject*` / `assertTask*`  
4. Delegate to `lib/momentum/*` service  
5. `NextResponse.json` with correct status  
6. Catch → `jsonServerError`

Match patterns in `app/api/documents/[id]/share/route.ts`.

### Errors

Always `{ "error": string }` via `lib/api-route-errors.ts`.

### AI calls

1. Create pending `ai_runs`  
2. `context-builder` assemble  
3. Deterministic engine if applicable  
4. Gemini if needed  
5. Write citations  
6. Complete run  
7. Return `ai_run_id` when LLM used  

### UI

- Preserve warm palette (`#f7f3ec`, `#9a5b2b`, etc.)  
- One primary CTA per screen  
- Loading: skeleton → metrics first for brief  
- Error: degraded deterministic view, never blank Home  

---

## Definition of done (MVP)

### Functional

- [ ] User completes onboarding → project + tasks exist  
- [ ] `/` shows Execute Home with AI brief (fallback works)  
- [ ] Execution score + health visible on Home  
- [ ] At-risk tasks listed with scores  
- [ ] “Why?” shows citations when LLM enabled  
- [ ] Goal simulation answers deadline feasibility  
- [ ] Recovery plan can be applied  
- [ ] `/documents` + `/doc/[id]` collab works  
- [ ] Share, comments, versions work on editor  

### Technical

- [ ] All patches applied in order on demo Supabase  
- [ ] `npm run lint` + `npm run build` pass  
- [ ] No changes to sync-server  
- [ ] `GEMINI_API_KEY` server-only  
- [ ] Every LLM feature writes `ai_runs`  

### Demo

- [ ] 60-second judge path rehearsed  
- [ ] Demo works with Gemini disabled  
- [ ] Seed data loaded for demo account  

---

## Testing before each PR

```bash
npm run lint --workspace=apps/web
npm run build --workspace=apps/web
npm run dev:server   # sync-server
npm run dev:web
```

Manual regression:

1. Login  
2. `/documents` → open doc → type → presence visible  
3. Share modal works  
4. New Lumina feature under test  

---

## Common mistakes to avoid

| Mistake | Why bad |
| --- | --- |
| Putting tasks on Socket.IO | Breaks architecture boundary |
| Storing `yjs_state` in AI context | Cost, privacy, noise |
| Skipping `ai_runs` | Breaks explainability + hackathon story |
| Default `apply: true` | Breaks trust |
| Editing document RLS casually | Breaks production collab |
| Building planner week in MVP | Cut; wastes hackathon time |
| Delaying Gemini to Sprint 5+ | Weak hackathon narrative |

---

## Quick links

- **Vision:** [lumina-vision.md](lumina-vision.md)  
- **What to build:** [lumina-mvp-scope.md](lumina-mvp-scope.md)  
- **Sprint plan:** [lumina-implementation-roadmap.md](lumina-implementation-roadmap.md)  
- **AI detail:** [lumina-ai-architecture.md](lumina-ai-architecture.md)  
- **Current codebase:** [lumina-write-existing-state.md](lumina-write-existing-state.md)  

# Hackathon Guardrails

If implementation choices conflict:

1. Preserve existing Lumina Write functionality.
2. Preserve collaborative editing.
3. Prefer deterministic logic over AI.
4. Prefer shipping over completeness.
5. Prefer judge-visible features over infrastructure.
6. Prefer Execute Home over Planner.
7. Prefer Risk Predictor over advanced task management.
8. Prefer Recovery Planner over additional AI agents.
9. Do not build features outside MVP Scope.
10. Follow the official cut order if time becomes constrained.

| [README](../README.md) | **You are here** |
