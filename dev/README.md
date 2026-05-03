# Development workspace

Use this folder to **track gaps**, **prioritize work**, and **write specs** before touching application code.

## Contents

| Path | Purpose |
|------|---------|
| [**`DEVELOPMENT_PLAN.md`**](./DEVELOPMENT_PLAN.md) | Phased roadmap, dependencies, exit criteria, weekly cadence |
| [`BACKLOG.md`](./BACKLOG.md) | Inventory of non-developed areas, partial modules, placeholders, and known bugs |
| [`specs/README.md`](./specs/README.md) | How to add feature specs |
| [`specs/_TEMPLATE.md`](./specs/_TEMPLATE.md) | Copy into `specs/<area>-<feature>.md` when starting work |

## Suggested workflow

1. Pick an item from **BACKLOG.md** (note severity: blocking vs UX-only).
2. Copy **`specs/_TEMPLATE.md`** → `specs/<topic>.md` and fill acceptance criteria + API/UI notes.
3. Implement backend routes/controllers **or** frontend pages against existing APIs (follow **Members** + **Finance** patterns).
4. Update BACKLOG.md when the item ships (move to a “Done” subsection or delete the row).

## Reference implementations

- **Full-stack slice:** `frontend/src/pages/MembersPage.jsx` ↔ `backend/src/controllers/memberController.js` ↔ `backend/src/routes/members.js`
- **Dashboard analytics:** `frontend/src/pages/DashboardPage.jsx` ↔ `backend/src/controllers/analyticsController.js`
- **Finance:** `backend/src/controllers/financeController.js` ↔ `backend/src/routes/finance.js`
