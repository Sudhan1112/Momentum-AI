# Release Checklist

Use this before tagging a release of the current Momentum AI product.

## Product checks

- create a project
- edit a project
- add tasks
- update task status, priority, due date, and assignee
- open planner and confirm today sections render
- open momentum and confirm brief/execution panels render
- compute project execution score
- generate a recovery plan
- run a goal simulation
- load timeline and decisions
- ask a project question through intelligence
- run task extraction
- run work breakdown
- generate a momentum-flow proposal if the environment supports it

## Permissions checks

- owner can update and delete the project
- admin can manage members
- editor can create and update tasks
- viewer can read project data but cannot mutate write routes

## Technical checks

- no failed required API requests in the browser
- `npm run test --workspace=apps/web` passes
- `npm run lint --workspace=apps/web` passes
- `npm run build --workspace=apps/web` passes

## Documentation checks

- no docs mention the retired collaborative documents feature as active
- route docs match current handlers
- architecture docs match the actual repo structure
