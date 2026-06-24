# Momentum AI

## What is Momentum AI?

**Momentum AI is an AI execution workspace for turning projects, tasks, and collaborative documents into finished work:** you can organize commitments, create or open docs, share with the right permissions, and keep writing in real time with teammates.

## Why is this interesting?

**Real-time collaboration is hard.** If two people edit the same paragraph at once, a naive app can scramble text, lose someone’s work, or show different versions to different people.

**This project tackles that head-on.** It keeps a single shared copy of each document **in sync across everyone’s screens** as fast as the network allows. Under the hood it uses a **CRDT** (Yjs) and a **dedicated realtime sync service** (Socket.IO) so typing, presence, and saved state stay aligned, with **roles and permissions** layered on top.

## Stack (one glance)

Next.js + TipTap, **Yjs** over **Socket.IO**, **Supabase** Auth, **PostgreSQL** with Row Level Security. Monorepo: **`apps/web`**, **`apps/sync-server`**.

**Live app:** https://lumina-write-editor.vercel.app/

## What you can do

- Sign in (Supabase: Google OAuth or email/password).
- Create documents, share them with roles, and request access (owners and admins manage invites and approvals).
- Co-edit in real time with presence and cursor colors.
- Comment, resolve, and manage comments by role.
- Save and restore version snapshots.

---

## Momentum AI Execution Workspace documentation

Momentum AI builds on the existing collaborative document foundation formerly known as Lumina Write. The docs below are the approved implementation handbook. **Start with the Codex handbook** before writing code.

| If you want to… | Open |
| --- | --- |
| **Start implementing (Codex / contributors)** | [docs/lumina-codex-handbook.md](docs/lumina-codex-handbook.md) |
| Product vision and north star | [docs/lumina-vision.md](docs/lumina-vision.md) |
| System architecture and migration | [docs/lumina-architecture.md](docs/lumina-architecture.md) |
| Database design (no SQL) | [docs/lumina-database-architecture.md](docs/lumina-database-architecture.md) |
| API and service boundaries | [docs/lumina-api-architecture.md](docs/lumina-api-architecture.md) |
| UI, navigation, demo flows | [docs/lumina-ui-architecture.md](docs/lumina-ui-architecture.md) |
| Momentum AI (primary AI reference) | [docs/lumina-ai-architecture.md](docs/lumina-ai-architecture.md) |
| MVP scope (must / should / defer) | [docs/lumina-mvp-scope.md](docs/lumina-mvp-scope.md) |
| Implementation roadmap (sprints) | [docs/lumina-implementation-roadmap.md](docs/lumina-implementation-roadmap.md) |
| Current codebase snapshot (pre-Lumina) | [docs/lumina-write-existing-state.md](docs/lumina-write-existing-state.md) |

### Suggested reading order (Momentum AI implementation)

| Step | Doc |
| --- | --- |
| **1** | [lumina-codex-handbook.md](docs/lumina-codex-handbook.md) |
| **2** | [lumina-mvp-scope.md](docs/lumina-mvp-scope.md) |
| **3** | [lumina-implementation-roadmap.md](docs/lumina-implementation-roadmap.md) |
| **4** | [lumina-database-architecture.md](docs/lumina-database-architecture.md) → [lumina-api-architecture.md](docs/lumina-api-architecture.md) |
| **5** | [lumina-ui-architecture.md](docs/lumina-ui-architecture.md) + [lumina-ai-architecture.md](docs/lumina-ai-architecture.md) |

---

## Documentation handbook

Technical articles live under **`docs/`** (this file is the **only** `README` at the repo root). Each doc has **Previous / Next** links at the bottom.

### How to use the docs folder

| If you want to… | Open |
| --- | --- |
| Set up your machine and run both apps | [docs/getting-started.md](docs/getting-started.md) |
| Understand flows, diagrams, and where code lives | [docs/architecture.md](docs/architecture.md) |
| See REST routes and Socket.IO at a glance | [docs/api-overview.md](docs/api-overview.md) |
| **REST request/response contracts** (OpenAPI-style, markdown) | [docs/rest-api-reference.md](docs/rest-api-reference.md) |
| Deep dive into the sync server (auth, payloads, errors) | [docs/sync-server-api.md](docs/sync-server-api.md) |
| Learn tables, RLS, and the role matrix | [docs/data-model.md](docs/data-model.md) |
| Read security notes, tradeoffs, hosting, AI attribution | [docs/security-and-operations.md](docs/security-and-operations.md) |
| Open a PR (lint, secrets, SQL changes) | [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) |
| Debug “can’t connect” / rejection reasons | [docs/troubleshooting.md](docs/troubleshooting.md) |

### Suggested reading order

Follow **1 → 8** the first time; use [docs/troubleshooting.md](docs/troubleshooting.md) whenever something breaks.

| Step | Doc | Overview |
| --- | --- | --- |
| **1** | [Getting started](docs/getting-started.md) | Clone, `.env`, `schema.sql`, `dev:server` / `dev:web`, root npm scripts. |
| **2** | [Architecture](docs/architecture.md) | Flows, `useCollabEditor`, sync, persistence, Mermaid diagrams, tech stack, repo spine. |
| **3** | [API overview](docs/api-overview.md) | `app/api` route map + Socket.IO cheat sheet. |
| **4** | [REST API reference](docs/rest-api-reference.md) | Per-route methods, bodies, response shapes, status codes. |
| **5** | [Sync server reference](docs/sync-server-api.md) | `/health`, CORS, JWT handshake, events, `doc:rejected` reasons. |
| **6** | [Data model & roles](docs/data-model.md) | ER diagram, RLS, role matrix, enforcement locations. |
| **7** | [Security & operations](docs/security-and-operations.md) | Security, tradeoffs, hosting, AI attribution. |
| **8** | [Contributing](docs/CONTRIBUTING.md) | PR checklist (lint, secrets, SQL/RLS callouts). |

**Optional:** [docs/web-nextjs-notes.md](docs/web-nextjs-notes.md) (Next.js template notes) · [`.env.example`](.env.example)

### Docs layout

```text
docs/
├── lumina-codex-handbook.md          ← start here for Momentum AI implementation
├── lumina-vision.md
├── lumina-architecture.md
├── lumina-database-architecture.md
├── lumina-api-architecture.md
├── lumina-ui-architecture.md
├── lumina-ai-architecture.md
├── lumina-mvp-scope.md
├── lumina-implementation-roadmap.md
├── lumina-write-existing-state.md
├── getting-started.md
├── architecture.md
├── api-overview.md
├── rest-api-reference.md
├── sync-server-api.md
├── data-model.md
├── security-and-operations.md
├── troubleshooting.md
├── CONTRIBUTING.md
└── web-nextjs-notes.md
```

**Start here:** [docs/getting-started.md](docs/getting-started.md)

**Contributing:** the guide lives only at [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) (GitHub does not auto-surface it from the repo root; use that link for PRs).

---

## Quick local run (cheat sheet)

```bash
npm install
cp .env.example apps/web/.env.local
cp .env.example apps/sync-server/.env
# fill in env values, run supabase/schema.sql on a new project
npm run dev:server
npm run dev:web
```

More detail: [docs/getting-started.md](docs/getting-started.md).
