# GraceERP — codebase inventory & backlog

_Generated from repository survey (frontend pages, backend routes/controllers, schema). Use [`specs/_TEMPLATE.md`](./specs/_TEMPLATE.md) when turning items into implementation work._

---

## Legend

| Tag | Meaning |
|-----|---------|
| **✓ mature** | Functional slice wired FE↔BE with real queries |
| **◐ partial** | APIs exist but incomplete, misleading UX, or generic/scaffold-only logic |
| **○ stub** | UI shell / placeholder copy only **or** BE returns placeholder JSON |
| **⚠ debt** | Known defect / refactor needed |

---

## 1. Mature enough for demos (**✓**)

| Area | Frontend | Backend | Notes |
|------|----------|---------|-------|
| Authentication | `LoginPage.jsx`, `authStore.js`, `api.js` interceptors | `authController.js`, `routes/auth.js`, JWT + bcrypt | Refresh rotation; `.env` loading hardened |
| Members | `MembersPage.jsx` | `memberController.js`, `routes/members.js` | CRUD + filters + stats |
| Dashboard KPIs & charts | `DashboardPage.jsx`, `branchScopeStore.js`, `setupAxiosBranchScope.js`, `Layout.jsx` branch picker | `analyticsController.js` (`dashboard`, `giving-trend`, `branch-comparison`), `branchScope` middleware | Live aggregates; super-admin branch scope via query; CSV export; dashboard labels match metrics |
| Finance & giving | `FinancePage.jsx` | `financeController.js`, `routes/finance.js` | Giving list/filters/pagination; record modal; summary by type/month; ledger pagination |
| Congregations | `BranchesPage.jsx` | `branchController.js`, `routes/branches.js` | Super-admin CRUD + archive; scoped read for branch admins |
| Staff access | `AccessPage.jsx` | `userController.js`, `routes/users.js` | Super-admin invite/edit/deactivate; branch-admin read-only directory |
| Sermons | `SermonsPage.jsx` | `sermonController.js`, `routes/sermons.js` | CRUD; scoped list; detail bumps play count |
| E-library | `LibraryPage.jsx` | `libraryController.js`, `routes/library.js` | CRUD; filters; detail bumps views |
| Events & RSVP | `EventsPage.jsx` | `eventController.js`, `routes/events.js` | CRUD; `/events/:id/rsvp`, `/events/:id/rsvps`; capacity waitlist |
| Live meetings | `MeetingsPage.jsx` | `meetingController.js`, `routes/meetings.js` | CRUD; `/meetings/:id/attendance`; status transitions |
| Assets | `AssetsPage.jsx` | `assetController.js`, `routes/assets.js` | CRUD; maintenance sub-resource |
| Facilities | `FacilitiesPage.jsx` | `facilityController.js`, `routes/facilities.js` | CRUD; facility bookings |
| HR | `HRPage.jsx` | `hrController.js`, `routes/hr.js` | Staff CRUD; leave requests |
| Pastoral | `PastoralPage.jsx` | `pastoralController.js`, `routes/pastoral.js` | Prayers, visits, welfare flags |
| Communications | `CommunicationsPage.jsx` | `communicationsController.js`, `routes/communications.js` | Messages CRUD + simulated send |
| Documents | `DocumentsPage.jsx` | `documentsController.js`, `routes/documents.js`, upload middleware | List/metadata + multipart upload |
| Budget | `BudgetPage.jsx` | `budgetController.js`, `routes/budget.js` | Budgets + expenditure requests |
| Audit | `AuditPage.jsx` | `auditController.js`, `routes/audit.js` | Read-only audit log + filters |
| Analytics | `AnalyticsPage.jsx` | `analyticsController.js`, `routes/analytics.js` | Giving trend, member growth, attendance, branch comparison, top content |

---

## 2. Frontend: **○ stub modules** (same placeholder pattern)

There are **no** remaining placeholder “Module / Connect to the API…” pages in this inventory; new screens should follow **Members**/**Finance** patterns from the start.

---

## 3. Backend: **○ placeholder mutations & detail routes**

Across many **`routes/*.js`** files copied from one scaffold, **`GET /:id`**, **`POST /`**, **`PUT /:id`**, **`DELETE /:id`** respond with JSON like **`… implement in controller`** (no DB writes).

Affected route modules (same pattern):

`churches` (and any remaining generic scaffolds not yet replaced)

_Real implementations:_ `branches`, `users` (Phase 3); `sermons`, `library`, `events`, `meetings` (Phase 4); Phase 5 operations modules (`assets`, `facilities`, `hr`, `budget`, `pastoral`, `communications`, `documents`, `audit`).

**Develop:** Introduce real controllers (as with `memberController` / `financeController`): validation, church/branch scoping, joins to related tables.

---

## 4. Backend: **◐ generic list-only scaffold**

Several routes implement **`GET /`** via copy-pasted conditional chains like `'budget' === 'budget' ? 'budgets'` and parameterized `SELECT * FROM … WHERE church_id = $1`.

**Issues:**

- Hard to maintain; should be refactored to explicit controllers per domain.
- **`GET /api/churches`** uses `WHERE church_id = $1`, but **`churches`** rows do **not** have **`church_id`** — **⚠ likely broken if called**.
- Branch-scoped `WHERE … branch_id = $2` is applied to tables that may lack **`branch_id`** in some routes—needs audit per entity.

**Develop:** Replace scaffold with targeted queries per table (see schema).

---

## 5. Schema vs API coverage (**○ gaps**)

Tables exist in [`database/schema.sql`](../database/schema.sql) **without** obvious dedicated REST flows in reviewed controllers:

| Table | Gap |
|-------|-----|
| `ledger_entries` | No dedicated ledger UI (finance controller may partly cover—confirm double-entry rules) |

_Covered in Phase 4–5:_ `meeting_attendance`, `event_rsvps`, `expenditure_requests`, `asset_maintenance`, `pastoral_visits`, `welfare_flags`, `leave_requests`, `facility_bookings`, `audit_logs`.

**Develop:** Design REST shape (`specs/*.md`), then controllers + FE tables/forms.

---

## 6. UX / product placeholders (**◐**)

| Location | Issue |
|----------|-------|
| `Layout.jsx` | Branch `<select>` is **local React state only**—does not switch `branchScope` API context |
| `Layout.jsx` | Notification / search / gear icons — **no handlers** |
| `Layout.jsx` | Pastoral nav **badge `"7"`** — hardcoded |
| `DashboardPage.jsx` | **“Export Report”** button — no action |
| `DashboardPage.jsx` | **“Full Report →”** — no navigation |
| `DashboardPage.jsx` | Subtitle **“HQ Overview”** — static (ignore branch selector) |
| `DashboardPage.jsx` | Card titled **“Attendance by Branch”** uses **`branchComparison`** (**member counts**, not attendance) — **misleading label** |
| `LoginPage.jsx` | **Demo credentials** panel — remove or gate behind `NODE_ENV`/feature flag for production |

---

## 7. Data & branding placeholders

| Item | Notes |
|------|-------|
| [`database/seed.js`](../database/seed.js) | Demo churches/branches/users/giving/etc.—safe for dev only |
| Demo emails `@clci.org` | Replace for production congregations |
| Root **`CAC_logo.png`** vs **`frontend/public/CAC_logo.png`** | Keep in sync manually when replacing artwork |

---

## 8. Operations / tooling (**◐**)

| Item | Notes |
|------|-------|
| `backend/.env` | Required secrets (DB, JWT in prod)—documented in `.env.example` |
| JWT dev auto-generation | `server.js` generates ephemeral secrets when missing—**sessions reset on restart** |
| Tests | No automated API/UI test suite observed |
| CI | No `.github/workflows` in survey |

---

## 9. Suggested priority order (opinionated)

1. Fix **`GET /api/churches`** (and audit similar WHERE clauses) — **⚠ correctness**.
2. Implement **Finance UI** (`FinancePage.jsx`) against existing **`financeController`** — high user value.
3. Flesh out **Branches** + **Users/Access** for admin workflows.
4. Replace stub pages module-by-module starting with **Events**, **Documents**, **Sermons** (high visibility).
5. Wire **Layout branch selector** to `branch_id` query param or user session preference + propagate to API helpers.

---

## 10. Quick file map for implementers

| Layer | Path |
|-------|------|
| API clients | `frontend/src/services/api.js` |
| Auth state | `frontend/src/context/authStore.js` |
| Branding constants | `frontend/src/constants/branding.js` |
| Express entry | `backend/src/server.js` |
| DB pool | `backend/src/config/database.js` |
| Auth middleware | `backend/src/middleware/auth.js` |
| Migrations / seed | `database/migrate.js`, `database/seed.js`, `database/schema.sql` |
