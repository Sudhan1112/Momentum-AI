# Lumina — Implementation Roadmap

> **Hackathon-optimized** sequence. AI foundation in Sprint 3 (not Sprint 5).  
> Simulation before Recovery. Sprint D wins demos.

**Do not touch:** `apps/sync-server/**`, `useCollabEditor.ts`, `editorExtensions.ts`, document API contracts.

---

## Timeline overview

```text
Sprint 0  Foundation
Sprint 1  Projects + Tasks
Sprint 2  Execution Dashboard
Sprint 3  Momentum AI Foundation     ← Gemini visible early
Sprint 4  Risk + Execution + Health
Sprint 5  Goal Simulation
Sprint 6  Recovery Planner
Sprint 7  Polish (optional features)
Sprint D  Demo Optimization
```

---

## Sprint 0 — Foundation

### Goals

Shared types and validation without changing runtime behavior.

### Features

- `types/project.ts`, `task.ts`, `momentum.ts`
- `lib/momentum/validation/*`
- `lib/momentum/authz.ts` stubs
- `.env.example` Gemini keys (documented, unused)

### Files to create

`apps/web/src/types/*`, `lib/momentum/validation/*`, `lib/momentum/authz.ts` (stubs)

### Files to modify

`.env.example` only

### Dependencies

None

### Risks

Over-abstraction — keep stubs minimal

### Validation checklist

- [ ] `npm run lint --workspace=apps/web`
- [ ] `npm run build --workspace=apps/web`
- [ ] Login, docs, collab unchanged

### Demo impact

None

---

## Sprint 1 — Projects + Tasks

### Goals

Execution domain end-to-end: DB → API → UI.

### Features

- Patches: project enums, RLS helpers, projects, members, tasks
- APIs: `/api/projects/**`, `/api/tasks/[id]`
- UI: `/projects`, `/projects/[id]`, task drawer
- Onboarding route skeleton

### Dependencies

Sprint 0

### Risks

RLS recursion — apply SECURITY DEFINER helpers before policies

### Validation checklist

- [ ] Patches 1–5 apply on Supabase
- [ ] Create project + tasks via API
- [ ] Non-member gets 403
- [ ] Documents/collab unchanged

### Demo impact

Low — data layer only

---

## Sprint 2 — Execution Dashboard

### Goals

Execute Home as landing; documents at `/documents`.

### Features

- Extract `AppShell` (sidebar, header)
- `ExecuteHome`: NextAction, TodayList, ProjectsPulse, BriefHero (template)
- `GET /api/planner/today`
- `/documents` (migrated doc dashboard)
- Onboarding wired to create project/tasks
- Optional: `documents.project_id` patch

### Files to modify

`app/page.tsx` → ExecuteHome; **do not** touch Editor or sync-server

### Dependencies

Sprint 1

### Risks

`page.tsx` regression — migrate docs in dedicated step

### Validation checklist

- [ ] Post-login lands on Execute Home
- [ ] `/documents` has doc library
- [ ] `/doc/[id]` collab works
- [ ] Onboarding creates project

### Demo impact

**High** — product identity shift

---

## Sprint 3 — Momentum AI Foundation

### Goals

**Google AI visible early.** Brief, panel, work breakdown, audit trail.

### Features

- Patches: memory, ai_runs, citations
- `gateway.ts`, `context-builder`, `run-logger`, `rate-limit`
- `morning-brief`, `work-breakdown` capabilities
- APIs: `/api/momentum/brief`, `/api/momentum/memory`, `/api/ai/work-breakdown`, `/api/ai/runs/[id]`
- UI: BriefHero (AI), MomentumPanel, ExplainabilityDrawer, ProposalReview
- Onboarding step 4: AI breakdown

### Dependencies

Sprint 1 tasks; `GEMINI_API_KEY`

### Risks

Gemini latency — **mandatory** template fallback

### Validation checklist

- [ ] Brief works with Gemini on AND off
- [ ] Every AI call writes `ai_runs`
- [ ] Citations on brief/breakdown
- [ ] Collab unchanged

### Demo impact

**Critical** — hackathon AI story starts here

---

## Sprint 4 — Risk + Execution Score + Workspace Health

### Goals

Home feels intelligent: scores + risk before recovery.

### Features

- Patch: `task_risk_scores`, `workspace_health_snapshots`
- `risk-scorer`, `execution-score`, `health-snapshot`
- APIs: risk, predict-risk, execution-score, health
- UI: score rings, health meter, AtRiskList, RiskChip, Why? sheet

### Dependencies

Sprint 3 gateway for optional risk explain

### Risks

Scores without due dates — show low-confidence copy

### Validation checklist

- [ ] Overdue tasks score higher
- [ ] Scores visible on Home without LLM
- [ ] Why? uses citations when LLM enabled

### Demo impact

**Critical** — prediction on Home

---

## Sprint 5 — Goal Simulation

### Goals

Wow moment: “Can I finish by June 29?” before recovery.

### Features

- Patch: `goal_simulations`
- `simulation-service`, `POST /api/ai/simulate-goal`
- SimulationModal on project overview
- CTA to recovery when infeasible

### Dependencies

Sprint 4 scores; Sprint 3 gateway for narrative

### Risks

Missing estimates — `simulation_confidence: low`

### Validation checklist

- [ ] Deadline shift shows feasible/infeasible
- [ ] Row persisted in `goal_simulations`
- [ ] Handoff to recovery flow

### Demo impact

**High** — easier judge wow than recovery alone

---

## Sprint 6 — Recovery Planner

### Goals

Credible replan after risk/simulation shows failure.

### Features

- Patches: recovery enums, recovery_plans
- `recovery-service`, triggers, APIs
- RecoveryCard, RecoveryFlow (Diagnose → Propose → Apply)
- Optional LLM narrative via Sprint 3 gateway

### Dependencies

Sprint 4 triggers; Sprint 5 handoff

### Risks

Bad auto-reschedule — user must Apply

### Validation checklist

- [ ] Trigger on ≥2 high-risk tasks (or seed)
- [ ] Apply updates tasks
- [ ] Risk/health refresh after apply

### Demo impact

**Critical** — completes execution loop

---

## Sprint 7 — Polish (optional)

### Goals

Gap-fill only if ahead of schedule.

### Features (optional)

- `POST /api/ai/extract-tasks` + modal
- Editor extract menu (one entry)
- `detect-blockers` rules-only
- Document link UI
- Mobile pass

### Removed from scope

- Planner week/calendar — **cut**

### Demo impact

Medium

---

## Sprint D — Demo Optimization

### Goals

Judge-ready; zero surprises.

### Deliverables

| Item | Detail |
| --- | --- |
| Demo seed | Project, 8 tasks, 2 risk scores, draft recovery, memory, doc, ai_run |
| Demo account | Pre-login browser |
| Fallback test | Full demo with `GEMINI_API_KEY` unset |
| AI cache | Brief + risk explain 4h TTL |
| Backup video | 90s golden path |
| Rehearsal | 60s × 5, 7min × 2 |
| Feature freeze | After D day 1 |

### Validation checklist

- [ ] 60s path < 90s wall clock
- [ ] Collab verified on demo doc
- [ ] Rate limits don’t block second judge run

### Demo impact

**Maximum**

---

## Critical path

```text
Sprint 0 → 1 → 2 → 3 (AI) → 4 → 5 → 6 → D
```

If slipping: cut Sprint 7 before Sprint 3.

---

## Exact build orders

### Database migrations

See [lumina-database-architecture.md](lumina-database-architecture.md#migration-order).

### API build order

See [lumina-api-architecture.md](lumina-api-architecture.md#build-order-api).

### UI build order

1. Projects/tasks UI (S1)  
2. AppShell + ExecuteHome (S2)  
3. Brief + MomentumPanel (S3)  
4. Scores + AtRisk (S4)  
5. SimulationModal (S5)  
6. RecoveryFlow (S6)  

### AI build order

1. run-logger → gateway → context-builder  
2. morning-brief → work-breakdown  
3. risk-scorer (deterministic)  
4. execution-score + health  
5. risk-explain  
6. simulation-service  
7. recovery-service  

---

## Daily safety gate

```bash
npm run lint --workspace=apps/web
npm run build --workspace=apps/web
# Manual: login → /documents → /doc/[id] → type → verify sync
```

---

## Related docs

| Doc | Purpose |
| --- | --- |
| [lumina-mvp-scope.md](lumina-mvp-scope.md) | Scope |
| [lumina-codex-handbook.md](lumina-codex-handbook.md) | Codex instructions |

| [← MVP scope](lumina-mvp-scope.md) | [Handbook](lumina-codex-handbook.md) |
