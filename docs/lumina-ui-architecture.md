# Lumina — UI Architecture

> Warm Lumina Write design language preserved. Execution-first information architecture.

---

## Product philosophy (UI)

Primary experience loop:

```text
Execution → Risk Awareness → Recovery → Completion
```

Not: Documentation → Organization.

---

## Information architecture

```text
Lumina
├── Execute (/)              ← default after login
├── Projects (/projects)
├── Planner (/planner)       ← today only in MVP
├── Documents (/documents)   ← migrated doc library
├── Momentum (/momentum)     ← hub + brief history
├── Onboarding (/onboarding)
└── Editor (/doc/[id])       ← unchanged collab
```

### Object → screen map

| Object | Primary screen |
| --- | --- |
| Project | `/projects/[id]` Overview |
| Task | Task drawer on project / home |
| Document | `/doc/[id]` |
| Brief | Home hero + `/momentum/brief` |
| Recovery | Home card + Recovery flow modal |
| Simulation | Project overview modal |
| AI evidence | Explainability drawer / `/momentum/runs/[id]` |

---

## Navigation

### Desktop shell

```text
┌────────────────────────────────────────────────────────────┐
│ Lumina    Execute · Projects · Planner · Documents  [◉][⌘K?] │
├──────────┬─────────────────────────────────────────────────┤
│ Sidebar  │ Main canvas                                     │
│ Execute  │                                                 │
│ Projects │                                                 │
│ Planner  │                                                 │
│ Documents│                                                 │
│ Momentum │                                                 │
│ Account  │                                                 │
└──────────┴─────────────────────────────────────────────────┘
```

Sidebar order = execution priority. Documents below Planner.

### Mobile

Bottom nav: **Execute | Projects | Planner | Momentum** (4 tabs). Documents via project or execute widget.

### Momentum entry points

| Entry | Behavior |
| --- | --- |
| Header orb | Opens **Momentum side panel** |
| Home brief | Expand full brief |
| Risk “Why?” | Explainability |
| Recovery card | Recovery flow |

**Not chatbot-first.** Panel shows insights + proposals; ask field collapsed.

---

## Dashboard design (Execute Home)

### Purpose

Answer in 5 seconds: *What now? What's at risk? Can I recover?*

### Layout

```text
┌─────────────────────────────────────────────────────────────┐
│ Good morning, {name}              Execution ●72  Health ◐68   │
├─────────────────────────────────────────────────────────────┤
│ MORNING BRIEF (hero) — metrics + AI narrative [Expand]      │
├──────────────────────────┬──────────────────────────────────┤
│ NEXT ACTION (one focus)  │ AT RISK (ranked)                 │
│ TODAY (compact list)     │ RECOVERY (if active plan)        │
│                          │ COMPLETED THIS WEEK              │
├──────────────────────────┴──────────────────────────────────┤
│ PROJECTS PULSE (horizontal)                                 │
└─────────────────────────────────────────────────────────────┘
```

### Hierarchy rationale

| Zone | Why first |
| --- | --- |
| Brief hero | Momentum orients |
| Scores in header | Ambient accountability |
| Next action | Anti-Notion single focus |
| At risk | Risk before organization |
| Recovery | Only when needed |
| Projects pulse | Context, not hero |

### Widget states

| Widget | Empty | Loading | Success | Error |
| --- | --- | --- | --- | --- |
| Brief | “Create a project to get your first brief” | Skeleton hero | Narrative + counts | Template fallback + retry |
| Next action | “Add a task due today” | Skeleton | Highlighted task | Hidden + banner |
| At risk | Hidden | Skeleton list | Ranked tasks | Empty + error toast |
| Recovery | Hidden | “Building plan…” | Action list | Draft saved message |
| Scores | `—` | Pulse placeholder | 0–100 rings | Hide + retry |

**Primary CTA:** **Start** on next action, or **Review recovery** when triggered.

---

## Project experience

### Project list (`/projects`)

Cards: title, deadline, execution score, risk badge, open task count. Sort: **Attention needed** default.

### Project detail tabs

```text
Overview | Tasks | Documents | Momentum
```

**Default: Overview** (not Tasks).

#### Overview components

- Goal + deadline header  
- Execution score + Health strip  
- Timeline bar (days vs work)  
- Top 3 at-risk tasks  
- Blockers (rules-based)  
- Active recovery plan  
- **Simulate deadline** link  

#### Tasks tab

- **Focus view** default (priority list)—not Trello board  
- Task rows with risk chips  
- Quick-add + task drawer  

### Task drawer

Slide-over: title, status, priority, due, assignee, risk chip, blockers, subtasks, linked doc, **Mark done** CTA.

---

## Planner experience

### MVP: Today only

**Route:** `/planner`  
**API:** `GET /api/planner/today` only.

Sections: **Overdue | Due today | In progress | Blocked**

No week view, no calendar in MVP (removed for hackathon).

### States

| State | Content |
| --- | --- |
| Empty | “Add due dates to tasks” |
| Loading | Section skeletons |
| Success | Grouped task chips |
| Error | Retry banner |

---

## Momentum experience

### Momentum panel (side)

```text
┌─ Momentum ──────────────┐
│ Context: Home / Project │
├─────────────────────────┤
│ Insight card            │
│ [Why?] [Recover]        │
├─────────────────────────┤
│ Proposals (checkboxes)  │
│ [Apply selected]        │
├─────────────────────────┤
│ Ask Momentum (collapsed)│
└─────────────────────────┘
```

### Momentum hub (`/momentum`)

Brief archive, memory (deferred UI), AI run history.

### AI capability → UI

| Capability | Surface |
| --- | --- |
| Morning brief | Home hero |
| Work breakdown | Onboarding step 4, task drawer |
| Risk explain | Risk chip → sheet |
| Recovery | Home card + flow |
| Simulation | Project overview modal |
| Explainability | Why? → runs page |

---

## First-time onboarding

```text
Login → /onboarding → / (Execute Home)
```

| Step | Learns | Friction |
| --- | --- | --- |
| 1. Goal | `goal_summary` | One text field |
| 2. Deadline | `target_deadline` | Date or skip |
| 3. Availability | memory `preference` | Chip: 2h / 4h / 6h+ |
| 4. Break down | tasks via AI WBS | Confirm checkboxes |

**Skip** creates minimal project + nudge on Home.

Post-onboarding: brief runs, next action populated.

---

## Demo flow

### 60-second path

```text
Login → Home (AI brief) → Scores → At risk → Why? (citations)
→ Simulate deadline → Not feasible → Recovery → Apply → Done
```

### 7-minute path

```text
Login (seeded) → Expand brief → Open Lumina MVP project
→ Risk strip → Simulate → Recovery propose → Apply
→ Planner today → Complete task → Home score updates
→ Documents → Editor collab proof (10s)
```

### Demo seed requirements

- 1 project, 8 tasks, 2 high-risk scores preloaded  
- 1 draft recovery plan  
- 1 memory preference  
- 1 linked doc + 1 completed `ai_run` with citations  

See [lumina-implementation-roadmap.md](lumina-implementation-roadmap.md) Sprint D.

---

## Component folders (planned)

```text
components/
  shell/       AppShell, Sidebar, TopNav
  execute/     ExecuteHome, BriefHero, AtRiskList, RecoveryCard, ...
  projects/    ProjectList, ProjectHeader, ...
  tasks/       TaskDrawer, RiskChip, ...
  momentum/    MomentumPanel, ExplainabilityDrawer, ...
  recovery/    RecoveryFlow, ...
  simulation/  SimulationModal, ...
```

---

## Related docs

| Doc | Purpose |
| --- | --- |
| [lumina-vision.md](lumina-vision.md) | Why |
| [lumina-ai-architecture.md](lumina-ai-architecture.md) | AI surfaces |

| [← API](lumina-api-architecture.md) | [Handbook](lumina-codex-handbook.md) | [AI →](lumina-ai-architecture.md) |
