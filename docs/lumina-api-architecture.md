# Lumina — API Architecture

> Route Handlers only. No Server Actions. Contracts for **new** Lumina APIs.  
> Existing document APIs: [rest-api-reference.md](rest-api-reference.md), [api-overview.md](api-overview.md).

---

## Conventions (inherited)

| Topic | Rule |
| --- | --- |
| Auth | `createClient()` session; `401` if absent |
| Cross-user joins | `createAdminClient()` after authz |
| Errors | `{ "error": string }` via `api-route-errors.ts` |
| Status | `400` validation, `401` auth, `403` forbidden, `404` not found, `409` conflict, `429` rate limit, `500` server |
| AI default | `apply: false` on mutation proposals |

---

## Route hierarchy

```text
/api
├── projects/
│   ├── route.ts                    GET, POST
│   └── [id]/
│       ├── route.ts                GET, PATCH, DELETE
│       ├── members/route.ts        GET, POST, PATCH, DELETE
│       ├── tasks/route.ts          GET, POST
│       ├── documents/route.ts      GET, POST (link)
│       ├── health/route.ts         GET
│       ├── execution-score/route.ts GET
│       └── recovery-plans/route.ts GET, POST
├── tasks/[id]/
│   ├── route.ts                    GET, PATCH, DELETE
│   ├── subtasks/route.ts           GET, POST
│   └── risk/route.ts               GET, POST
├── planner/
│   └── today/route.ts              GET
├── momentum/
│   ├── memory/route.ts             GET, POST
│   ├── memory/[id]/route.ts        GET, PATCH, DELETE
│   ├── brief/route.ts              GET, POST
│   ├── execution-score/route.ts    GET
│   └── health/route.ts             GET
├── ai/
│   ├── extract-tasks/route.ts      POST
│   ├── work-breakdown/route.ts     POST
│   ├── predict-risk/route.ts       POST
│   ├── recovery-plan/route.ts      POST
│   ├── simulate-goal/route.ts      POST
│   ├── detect-blockers/route.ts    POST (optional MVP)
│   └── runs/[id]/route.ts          GET
└── documents/                      FROZEN — existing routes
```

**Removed from MVP:** `/api/planner/week`, `/api/planner/calendar`

---

## API domains

| Domain | Responsibility | Authz |
| --- | --- | --- |
| **Projects** | CRUD, archive, stats | Member / owner |
| **Members** | Invite, roles, remove | Owner/admin |
| **Tasks** | CRUD, status, due dates | Write role |
| **Planner** | Today/overdue/in-progress buckets | Member |
| **Momentum Memory** | User/project context | Owner + member read |
| **Brief** | Daily orientation | Self |
| **Scoring** | Execution score, health | Member |
| **Risk** | Scores + optional explain | Member |
| **Recovery** | Draft/apply plans | Write/admin apply |
| **Simulation** | What-if feasibility | Write role |
| **AI** | Proposals + audit | Write role for mutations |

---

## Service boundaries

Route handlers stay thin (~50–120 lines). Logic in `lib/momentum/`:

```text
lib/momentum/
├── authz.ts
├── validation/
├── projects/          project-service, member-service
├── tasks/             task-service
├── planner/           planner-service
├── memory/            memory-service
├── scoring/           risk-scorer, execution-score, health-snapshot
├── recovery/          recovery-service, recovery-triggers
├── simulation/        simulation-service
├── documents/         document-context.ts
└── ai/
    ├── gateway.ts
    ├── context-builder.ts
    ├── run-logger.ts
    ├── rate-limit.ts
    └── capabilities/
```

---

## Authorization strategy

### Helpers (`lib/momentum/authz.ts`)

| Function | Use |
| --- | --- |
| `requireSession()` | All routes |
| `assertProjectMember` | Read |
| `assertProjectWriteRole` | Task/AI mutations |
| `assertProjectOwnerOrAdmin` | Members, recovery apply |
| `assertProjectOwner` | Project delete |
| `assertTaskAccess` | Task by id |
| `assertDocumentOwnerForLink` | Link doc to project |
| `canReadAiRun` | Explainability |

### Project role matrix

| Action | owner | admin | editor | commenter | viewer |
| --- | --- | --- | --- | --- | --- |
| View project/tasks | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit tasks | ✓ | ✓ | ✓ | | |
| Run AI / apply proposals | ✓ | ✓ | ✓ | | |
| Manage members | ✓ | ✓ | | | |
| Apply recovery | ✓ | ✓ | | | |

### Client selection

| Operation | Client |
| --- | --- |
| User-scoped insert with RLS | Session `createClient()` |
| Hydration with profiles | `createAdminClient()` after authz |
| AI run + citation writes | Admin after authz |
| Cron (deferred) | Admin + secret header |

---

## Validation strategy

| Layer | Location | Responsibility |
| --- | --- | --- |
| Transport | `parseJsonObject` | JSON parse |
| Schema | `validation/schemas.ts` | UUID, enums, lengths |
| Business | Services | Cycles, access, dedupe |
| Database | Supabase errors | Map to 400/409/404 |

### Limits

| Field | Max |
| --- | --- |
| `title` | 200 chars |
| `description` | 10,000 chars |
| `memory.content` | 8,000 chars |
| AI `text` input | 32,000 chars |
| `document_excerpt` | 8,000 chars |

Never trust `user_id` from request body—use session.

---

## AI gateway strategy

| Rule | Detail |
| --- | --- |
| Provider | **Gemini** (`GEMINI_API_KEY`, server-only) |
| Model | `gemini-2.0-flash` (or `gemini-1.5-flash`) |
| Interface | `gateway.completeJson()` / `completeText()` |
| Flow | authz → create pending `ai_run` → context-builder → LLM → citations → complete run |
| Default | `apply: false` |
| Timeout | 25s |
| Rate limits | See [lumina-ai-architecture.md](lumina-ai-architecture.md) |

---

## Build order (API)

| Order | Route | Sprint |
| --- | --- | --- |
| 1 | `/api/projects`, `/api/projects/[id]` | 1 |
| 2 | `/api/projects/[id]/tasks`, `/api/tasks/[id]` | 1 |
| 3 | `/api/planner/today` | 2 |
| 4 | `/api/momentum/brief`, `/api/momentum/memory`, `/api/ai/work-breakdown`, `/api/ai/runs/[id]` | 3 |
| 5 | `/api/tasks/[id]/risk`, `/api/ai/predict-risk`, `/api/momentum/execution-score`, `/api/momentum/health` | 4 |
| 6 | `/api/ai/simulate-goal` | 5 |
| 7 | `/api/projects/[id]/recovery-plans`, `/api/ai/recovery-plan` | 6 |

**Frozen:** all `/api/documents/**`, `/api/users/search`, `/auth/callback`

---

## Related docs

| Doc | Purpose |
| --- | --- |
| [lumina-ai-architecture.md](lumina-ai-architecture.md) | Capability detail |
| [lumina-implementation-roadmap.md](lumina-implementation-roadmap.md) | Sprint plan |

| [← Database](lumina-database-architecture.md) | [Handbook](lumina-codex-handbook.md) | [UI →](lumina-ui-architecture.md) |
