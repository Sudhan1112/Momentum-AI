# Lumina — Product Vision

> **North Star:** Lumina is an **AI Execution Workspace** where **Momentum AI** acts as an execution operating system—continuously planning, prioritizing, predicting risk, recovering from setbacks, and helping users finish meaningful work before deadlines fail.

**Live app (current):** https://lumina-write-editor.vercel.app/  
**Evolution:** Lumina Write (collaborative editor) → **Lumina** (execution OS with documents as deliverables).

---

## Problem statement

Knowledge workers do not fail because they lack tools to write or organize information. They fail because:

- Commitments fragment across docs, chats, and mental lists
- Deadlines slip before risk is visible
- Setbacks trigger guilt instead of credible replans
- AI assistants answer questions but do not **execute** against goals

Lumina addresses **finishing meaningful work on time**, not storing more content.

---

## Product positioning

| Dimension | Lumina |
| --- | --- |
| **Category** | AI Execution Workspace |
| **Primary loop** | Execute → Sense risk → Recover → Complete |
| **Secondary surface** | Collaborative documents (deliverables) |
| **AI role** | Momentum AI — ambient copilot, not chat-first |
| **User** | Individual or small team with deadline-driven commitments |

---

## Why Lumina is not Notion (or Trello, ClickUp, Motion)

| Product | Mental model | Why Lumina differs |
| --- | --- | --- |
| **Notion** | Documentation → organization | Lumina leads with **execution** and **risk**, not blank pages |
| **Trello** | Columns of cards | Lumina prioritizes **one next action** and **recovery**, not boards |
| **ClickUp** | Configurable everything | Lumina keeps a **tight execution schema** (projects, tasks, scores) |
| **Motion** | Auto-scheduling black box | Lumina **suggests**; user applies. Explainability is mandatory |

### Differentiation pillars

1. **Execution first** — Home shows what must happen today before any file list  
2. **Risk as ambient signal** — Risk is color, rank, and brief copy—not a buried report  
3. **Recovery over guilt** — Setbacks trigger replan proposals, not shame badges  
4. **Explainability** — Every AI suggestion links to evidence (`ai_runs`, citations)  
5. **Completion as the win** — Progress = finished meaningful work, not document count  
6. **Calm density** — Warm Lumina Write palette; one primary action per screen  

---

## Why Lumina is an AI Execution Workspace

An **execution workspace** coordinates:

```text
Intent (project goal + deadline)
    → Tasks (actionable units)
    → Execution (planner today, next action)
    → Sensing (risk, health, execution score)
    → Recovery (replan when slipping)
    → Completion (closure, brief, score)
```

Documents remain **first-class deliverables** linked to projects/tasks—but the product opens on **Execute**, not a doc grid.

---

## Momentum AI philosophy

| Principle | Meaning |
| --- | --- |
| **Deterministic first** | Scores, triggers, and rankings from formulas. LLMs narrate and propose—not compute truth. |
| **Propose, never silently mutate** | `apply: false` default. User confirms tasks, recovery plans, breakdowns. |
| **Evidence over eloquence** | Every insight links to `ai_run_citations`. |
| **Small context, sharp prompts** | Structured JSON summaries—never raw `yjs_state`. |
| **One gateway, many capabilities** | Single Gemini gateway—no multi-agent orchestration in v1. |
| **Ambient + panel** | Brief on Home, Momentum side panel, optional ⌘K later—not chatbot-first. |

Momentum should:

- Understand work (projects, tasks, linked docs)  
- Predict risk (deterministic scorer + optional explain)  
- Detect blockers (rules-first)  
- Propose recovery (deterministic actions + narrative)  
- Simulate outcomes (“Can I finish by June 29?”)  
- Generate daily briefs (metrics + narrative)  
- Learn preferences over time (Momentum Memory)  

---

## Success criteria

### Hackathon MVP

A judge can, in **under 90 seconds**:

1. Land on **Execute Home** with an **AI Morning Brief**  
2. See **Execution Score** and **Workspace Health**  
3. View **at-risk tasks** and tap **Why?** with citations  
4. Run **Goal Simulation** on a deadline  
5. **Apply a Recovery Plan** and see execution improve  
6. Open a **collaborative document** and verify real-time editing still works  

### Product MVP (post-hackathon)

- Users create projects with deadlines and tasks without friction  
- Risk visible before failure; recovery is one-click review + apply  
- AI features auditable via `ai_runs`  
- Document collab, sharing, comments, versions unchanged  
- Gemini is the sole inference provider; deterministic fallbacks always work  

---

## Related docs

| Doc | Purpose |
| --- | --- |
| [lumina-architecture.md](lumina-architecture.md) | System design |
| [lumina-ui-architecture.md](lumina-ui-architecture.md) | Screens and flows |
| [lumina-ai-architecture.md](lumina-ai-architecture.md) | Momentum AI deep dive |
| [lumina-mvp-scope.md](lumina-mvp-scope.md) | Build scope |
| [lumina-codex-handbook.md](lumina-codex-handbook.md) | Start here for implementation |

| [← Lumina handbook](lumina-codex-handbook.md) | [Next: Architecture →](lumina-architecture.md) |
