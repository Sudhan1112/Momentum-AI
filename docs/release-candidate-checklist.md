# Momentum AI Release Candidate Checklist

Use this as the standard release gate before shipping a checkpoint such as `v1.0.0-mvp`, `v1.1.0`, or a sprint-complete tag. The goal is to verify product correctness, evidence integrity, and regression safety rather than stopping at build health alone.

Estimated time: 30-40 minutes

Before starting:

- Clear stale browser tabs for the app.
- Open DevTools `Console` and `Network`.
- Use one known project with existing history.
- Have one read-only account ready for the permissions pass.

## Phase 1 - Momentum Memory (10 min)

### 1. Timeline

Action:

- Open a project with existing history.
- Refresh twice.

Expected:

- Newest events appear first.
- Groups show `Today`, `Yesterday`, then older dates.
- No duplicate entries appear.
- Empty state, if applicable, looks polished and intentional.

Pass/Fail: `[ ] Pass [ ] Fail`

### 2. Manual Decisions

Action:

- Create an `Architecture` decision.
- Create a `Timeline` decision.
- Create a `Product` decision.

Expected:

- Categories render correctly.
- Importance badges render correctly.
- Status shows `Accepted`.
- All decisions still exist after refresh.

Pass/Fail: `[ ] Pass [ ] Fail`

### 3. Evidence Drawer

Action:

- Open every decision.

Expected:

- Only linked evidence appears.
- No unrelated events appear.
- Timestamps are correct.
- Ordering is correct and readable.

Pass/Fail: `[ ] Pass [ ] Fail`

### 4. Citation Integrity

Action:

- Create one decision with multiple linked evidence items.

Expected:

- Badge count matches the actual number of linked items.
- Every citation maps to the correct underlying event.
- Every evidence event belongs to the same project.
- No duplicate evidence appears.
- No broken or missing references appear after refresh.

Pass/Fail: `[ ] Pass [ ] Fail`

## Phase 2 - Event Journal (5 min)

Action:

- Create a task.
- Edit a task.
- Change task priority.
- Complete a task.
- Generate a recovery plan.
- Run a simulation.

Expected:

- Timeline updates automatically.
- No manual sync step is needed.
- Event summaries are readable at a glance.

Pass/Fail: `[ ] Pass [ ] Fail`

## Phase 3 - Permissions (3 min)

Action:

- Sign in with a read-only account.

Expected:

- Timeline is visible.
- Decisions are visible.
- `Record Decision` is hidden or disabled.
- Evidence drawer is still accessible.

Pass/Fail: `[ ] Pass [ ] Fail`

## Phase 4 - Performance (5 min)

Action:

- Use a project with roughly `100+` events.
- Use a project with roughly `20+` decisions.

Expected:

- Timeline loads smoothly.
- Filters respond instantly.
- Evidence drawer opens without noticeable delay.
- Scrolling remains smooth.
- No duplicate network requests appear on refresh.
- No UI freezes occur.

Pass/Fail: `[ ] Pass [ ] Fail`

## Phase 5 - Full Regression (10 min)

Verify:

- `[ ] Documents`
- `[ ] Collaborative Editor`
- `[ ] Comments`
- `[ ] Sharing`
- `[ ] Realtime Collaboration`
- `[ ] Recovery Planner`
- `[ ] Goal Simulation`
- `[ ] Momentum Flow`
- `[ ] Execute Home`
- `[ ] Daily Brief`
- `[ ] Work Breakdown`
- `[ ] Task Extraction`

Expected:

- All existing features behave exactly as before.

## Phase 6 - Release Health

Developer Console:

- `[ ] No console errors`

Network:

- `[ ] No failed API requests`
- `[ ] No unexpected retries`
- `[ ] No duplicate requests`

Validation:

- `[ ] Tests pass`
- `[ ] TypeScript passes`
- `[ ] Build passes`
- `[ ] Lint passes` with known `<img>` warnings acceptable

## Ship Decision

Release only if every critical item passes.

| Area | Status |
| --- | --- |
| Timeline | `[ ]` |
| Decisions | `[ ]` |
| Evidence | `[ ]` |
| Event Journal | `[ ]` |
| Permissions | `[ ]` |
| Performance | `[ ]` |
| Regression | `[ ]` |
| Console | `[ ]` |
| Network | `[ ]` |
| Build | `[ ]` |

## Suggested Release Commands

Run only after the checklist is fully green.

```bash
git add .
git commit -m "feat: sprint x2b momentum memory"
git tag sprint-x2b-complete
git push origin main
git push origin sprint-x2b-complete

git tag v1.0.0-mvp
git push origin v1.0.0-mvp
```

## After `v1.0.0-mvp`

Recommended one-day pause before the next feature sprint:

1. Record a polished 5-7 minute demo.
2. Create a strong README with screenshots, architecture, setup, and feature highlights.
3. Prepare a hackathon deck covering the problem, solution, architecture, AI flow, demo path, and roadmap.

---

| [Previous: Troubleshooting](troubleshooting.md) | [Handbook (root README)](../README.md#documentation-handbook) | [Contributing](CONTRIBUTING.md) |
