# GraceERP — development plan

Companion doc: **[BACKLOG.md](./BACKLOG.md)** (inventory). Use **[specs/_TEMPLATE.md](./specs/_TEMPLATE.md)** before medium/large slices.

---

## Guiding principles

1. **Correctness before breadth** — Fix broken or misleading APIs/UI before adding modules.
2. **One vertical slice at a time** — Backend controller + routes + frontend page + API client updates together.
3. **Reuse patterns** — Treat **Members** + **Finance controller** + **Dashboard** as templates for CRUD, reporting, and charts.

---

## Phase 0 — Foundations (short)

| # | Deliverable | Why |
|---|-------------|-----|
| P0.1 | Confirm **`GET /api/churches`** (and similar list routes) use valid **`WHERE`** clauses per table | Avoid silent SQL failures |
| P0.2 | Replace duplicated generic route files with **explicit controllers** per domain *or* document “list-only OK” routes | Maintainability |
| P0.3 | Implement **`GET /api/churches/:id`** + **`PUT`** for congregation profile (name, address, branding fields) | Needed for settings screen later |

**Exit criteria:** `/health` OK; churches read/update safe for admin role; no placeholder responses on endpoints you expose publicly.

---

## Phase 1 — Finance vertical (**done**)

| # | Deliverable | Status |
|---|-------------|--------|
| P1.1 | **`FinancePage.jsx`** — giving list, filters, pagination, empty/error states | ✓ |
| P1.2 | **Record giving** modal (`POST /finance/giving`), branch + optional member | ✓ |
| P1.3 | **Summary** + **Ledger** tabs (`/finance/summary`, `/finance/ledger`) | ✓ |
| — | **`GET /api/branches`** fixed for real schema (was broken when scoped) | ✓ |
| — | Ledger API returns **`pagination`**; **`recordGiving`** requires **`branch_id`** for super admins | ✓ |
| — | **`GET /finance/summary`** gated same roles as other finance reads | ✓ |

**Follow-ups (later phases):** PDF export, member search-as-you-type. Layout branch scope + dashboard CSV landed in Phase 2.

---

## Phase 2 — Branch context & dashboard honesty (**done**)

| # | Deliverable | Depends on | Status |
|---|-------------|------------|--------|
| P2.1 | **`Layout.jsx`** branch `<select>` drives **`branch_id`** (global store + axios interceptor → query) | Auth/store design choice | ✓ |
| P2.2 | **`branchScope`** + controllers use **`req.branchId`** from query for super admins; non–super admins stay on **`user.branch_id`** | P2.1 | ✓ |
| P2.3 | **Dashboard** — member-count card labels (not “attendance”); dynamic subtitle vs static “HQ Overview”; giving trend year from UI state | P2.1 optional | ✓ |
| P2.4 | **Export Report** — CSV download of KPIs + trend + congregation rows | — | ✓ |
| — | **`GET /api/branches`** — super admins always receive full active branch list (picker); scoped roles filtered to **`user.branch_id`** | — | ✓ |
| — | **`branch-comparison`** available to scoped roles (single-row when scoped); **`giving-trend`** uses **`req.branchId` only** (no query escalation) | — | ✓ |

**Exit criteria:** Multi-branch churches see scoped numbers; dashboard labels match data.

---

## Phase 3 — Administration & directory (**done**)

| # | Deliverable | Depends on | Status |
|---|-------------|------------|--------|
| P3.1 | **`BranchesPage.jsx`** — list/create/edit + archive; **`branchController`** + **`routes/branches`** | Phase 0 scaffold cleanup | ✓ |
| P3.2 | **`AccessPage.jsx`** — staff list (scoped); super-admin invite/edit/deactivate; **`userController`** + **`routes/users`** | Auth rules | ✓ |
| P3.3 | Stub placeholders replaced on **`/api/branches`** and **`/api/users`** | Phase 0 | ✓ |

**Exit criteria:** Super admin manages branches and staff accounts from UI.

**Notes:** Congregation **`GET`** keeps picker behaviour (`include_all_statuses` for admin lists). **`DELETE /branches/:id`** archives (`status = archived`). **`DELETE /users/:id`** deactivates (`is_active = false`). Last active **`super_admin`** cannot be demoted or deactivated by rule.

---

## Phase 4 — Content & programmes (**done**)

| Module | Frontend | Backend | Status |
|--------|----------|---------|--------|
| Sermons | `SermonsPage.jsx` | `sermonController.js`, `routes/sermons.js` | ✓ List/detail (+ play bump), CRUD, branch nullable / scoped list |
| Library | `LibraryPage.jsx` | `libraryController.js`, `routes/library.js` | ✓ Church-wide resources; category/format filters; view bump; CRUD |
| Events + RSVP | `EventsPage.jsx` | `eventController.js`, `routes/events.js` | ✓ Branch-scoped events; `GET/POST …/rsvp`, `GET …/rsvps`; capacity + waitlist |
| Meetings | `MeetingsPage.jsx` | `meetingController.js`, `routes/meetings.js` | ✓ Branch nullable / scoped list; `GET/POST …/attendance`; status live/end |

**Exit criteria:** Each module has list + detail + create/edit + branch/church scope.

**Roles:** Mutations use `authorize('super_admin','branch_admin','pastor','content_manager')` on sermon/library/event/meeting writes (aligned with Members-style content duties).

---

## Phase 5 — Operations & pastoral (**done**)

| Module | Frontend | Backend | Status |
|--------|----------|---------|--------|
| Assets | `AssetsPage.jsx` | `assetController.js`, `routes/assets.js` | ✓ CRUD; `GET/POST …/:id/maintenance` |
| Facilities | `FacilitiesPage.jsx` | `facilityController.js`, `routes/facilities.js` | ✓ CRUD; bookings list/create/update |
| HR | `HRPage.jsx` | `hrController.js`, `routes/hr.js` | ✓ Staff CRUD; `GET/POST /leave-requests`, `PUT …/:id` |
| Pastoral | `PastoralPage.jsx` | `pastoralController.js`, `routes/pastoral.js` | ✓ `/prayers`, `/visits`, `/welfare` subpaths |
| Communications | `CommunicationsPage.jsx` | `communicationsController.js`, `routes/communications.js` | ✓ CRUD + `POST …/:id/send` (simulated) |
| Documents | `DocumentsPage.jsx` | `documentsController.js`, `routes/documents.js`, `middleware/documentUpload.js` | ✓ JSON create, `POST /upload` (multipart), metadata update |
| Budget | `BudgetPage.jsx` | `budgetController.js`, `routes/budget.js` | ✓ Budgets CRUD; expenditure requests CRUD |
| Audit | `AuditPage.jsx` | `auditController.js`, `routes/audit.js` | ✓ Read-only list + detail; filters |

**Exit criteria:** Each module is list-first with real FE↔BE wiring; mutations match `authorize(...)` roles per route file.

---

## Phase 6 — Quality & launch readiness

| # | Deliverable |
|---|-------------|
| P6.1 | Remove or env-gate **demo credentials** block on login |
| P6.2 | Production **`JWT_*`** enforcement (already strict); document rotate procedures |
| P6.3 | Smoke tests (API integration or E2E on critical paths: login, members list, finance record) |
| P6.4 | README ops: migrate/seed/backup, `.env` checklist |

---

## Dependency sketch

```text
Phase 0 ──► Phase 3 (branches/users need correct APIs)
    │
    └──► Phase 1 (Finance UI)

Phase 2 can overlap Phase 1 after P0.1–P0.2 stabilize routing.

Phase 4–5 parallel tracks once Phase 1–P3 exit criteria are met for your congregation’s priorities.
```

---

## Cadence suggestion

- **Weekly:** Ship one numbered slice (e.g. P1.1+P1.2) with a filled **`specs/*.md`**.
- **Definition of done:** Merged PR + BACKLOG row updated + manual smoke on Windows + Postgres.

---

## Immediate next actions (this week)

1. Spec **`specs/api-churches-fix.md`** — SQL + roles + acceptance tests for congregation endpoints (Phase P0).
2. Spec **`specs/finance-ui-mvp.md`** — screens & empty states (Phase P1).
3. Decide **branch scope UX**: query param (`?branch_id=`) vs Zustand store (Phase P2).
