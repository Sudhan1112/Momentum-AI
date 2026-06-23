# Lumina — MVP Scope

> Hackathon-optimized scope. **Judge impact** over feature completeness.

**Locked MVP stack:**

```text
Projects → Tasks → Momentum Brief → Execution Score → Workspace Health
→ Risk Predictor → Goal Simulation → Recovery Planner
```

Everything else is secondary.

---

## Must build

| Area | Deliverable | Sprint |
| --- | --- | --- |
| **Foundation** | Types, validation, authz | 0 |
| **Projects** | CRUD, members, list/detail UI | 1 |
| **Tasks** | CRUD, drawer, project tasks | 1 |
| **Execute Home** | Landing dashboard, AppShell, nav | 2 |
| **Documents relocate** | `/documents` library; editor unchanged | 2 |
| **Planner today** | `GET /api/planner/today` + UI sections | 2 |
| **Onboarding** | 4 steps (goal, deadline, availability, breakdown) | 2–3 |
| **Gemini gateway** | Flash, JSON mode, timeout, retry | 3 |
| **AI audit** | `ai_runs`, `ai_run_citations`, runs page | 3 |
| **Morning brief** | Deterministic metrics + Gemini narrative + fallback | 3 |
| **Momentum panel** | Side panel, orb in header | 3 |
| **Work breakdown** | Onboarding + task drawer; ProposalReview | 3 |
| **Momentum memory** | Onboarding preference + retrieval | 3 |
| **Execution score** | Deterministic; Home + project header | 4 |
| **Workspace health** | Deterministic; Home + project | 4 |
| **Risk predictor** | Deterministic scores; At Risk list; chips | 4 |
| **Risk explain** | “Why?” with citations (LLM optional) | 4 |
| **Goal simulation** | Feasibility math + narrative; modal | 5 |
| **Recovery planner** | Deterministic actions; apply flow | 6 |
| **Collab regression** | Documents, share, comments, Yjs verified | All |
| **Demo optimization** | Seed data, cache, fallbacks, rehearse | D |

---

## Should build

| Area | Deliverable | Sprint |
| --- | --- | --- |
| Task extraction (paste text) | `POST /api/ai/extract-tasks` | 7 |
| Recovery LLM narrative | Polish on plan summary | 6 |
| Brief 4h cache | Demo performance | D |
| Document ↔ project link | Optional FK + UI | 7 |
| Editor “Extract tasks” menu | Single menu entry | 7 |
| Blocker detection (rules-only) | No LLM | 7 |
| `detect-blockers` API | Rules engine | 7 |

---

## Can defer (post-hackathon)

| Feature | Reason |
| --- | --- |
| Planner week / calendar view | Judges care about prediction/recovery, not calendar |
| `task_dependencies` table | Rules sufficient |
| Project access requests | Owner-invite only |
| Command palette (⌘K) | Power user |
| Cron / internal recompute | Manual refresh OK |
| Full `/momentum` memory manager UI | Panel + runs enough |
| Auto-learned behavior patterns | Manual memory first |
| LLM execution score tips | Template tips enough |
| Task extract from live yjs | Client plain text OK |
| Blocker LLM classification | Rules sufficient |
| gemini-pro / thinking models | Flash only |
| Embeddings / vector memory | Recency rank enough |
| `ai_run_payloads` table | Summaries only |
| Fold patches into `schema.sql` | Post-demo housekeeping |

---

## Removed from MVP (not deferred)

| Feature | Reason |
| --- | --- |
| PlannerWeekView, DayColumn | Cut entirely |
| `GET /api/planner/week` | Cut |
| `GET /api/planner/calendar` | Cut |
| Multi-provider AI | Gemini only |
| Server Actions | Architecture decision |
| Prisma / Drizzle | Architecture decision |
| AI on sync-server | Architecture decision |

---

## Cut order (if time runs out)

Cut **first** → **last** (never cut items at bottom):

1. Planner today UI polish  
2. Editor extract tasks  
3. Task extraction API  
4. detect-blockers  
5. Document ↔ project link  
6. Simulation narrative (keep math)  
7. Recovery narrative (keep actions)  
8. Risk LLM explain (keep factor bars)  
9. Goal simulation entirely  
10. Recovery planner  
11. Risk predictor  
12. **Never cut:** Brief + ai_runs + Projects + Tasks + Execute Home + collab  

---

## 10-day minimum plan

| Days | Ship |
| --- | --- |
| 1 | Sprint 0 + 1 |
| 2–3 | Sprint 2 |
| 4–5 | **Sprint 3 (AI)** |
| 6 | Sprint 4 |
| 7 | Sprint 5 |
| 8 | Sprint 6 |
| 9–10 | **Sprint D** |

Skip Sprint 7 optional features.

---

## Related docs

| Doc | Purpose |
| --- | --- |
| [lumina-implementation-roadmap.md](lumina-implementation-roadmap.md) | Sprint detail |
| [lumina-codex-handbook.md](lumina-codex-handbook.md) | Implementation guide |

| [← AI Architecture](lumina-ai-architecture.md) | [Handbook](lumina-codex-handbook.md) | [Roadmap →](lumina-implementation-roadmap.md) |
