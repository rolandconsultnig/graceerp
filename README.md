# GraceERP — Full-Stack Church ERP Platform

A production-ready, multi-tenant Church Enterprise Resource Planning system built with:

- **Frontend**: React 18 + Vite + TailwindCSS + React Router + Zustand + Recharts
- **Backend**: Node.js + Express.js (REST API)
- **Database**: PostgreSQL 14+ with full schema, migrations, and seed data
- **Auth**: JWT (access + refresh tokens), RBAC, branch-scoped middleware

---

## Project Structure

```
graceerp/
├── frontend/                    # React application
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx       # Sidebar + topbar shell
│   │   │   └── UI.jsx           # Reusable component library
│   │   ├── context/
│   │   │   └── authStore.js     # Zustand auth state
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx    # Auth screen
│   │   │   ├── DashboardPage.jsx # Live analytics dashboard
│   │   │   ├── MembersPage.jsx  # Full CRUD with API
│   │   │   └── ...              # 16 more module pages (scaffolded)
│   │   ├── services/
│   │   │   └── api.js           # Axios + all API service methods
│   │   ├── App.jsx              # Router + protected routes
│   │   └── main.jsx             # React entry point
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── backend/                     # Express API server
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js      # PostgreSQL pool + query helpers
│   │   ├── controllers/
│   │   │   ├── authController.js     # Login, refresh, logout, me
│   │   │   ├── memberController.js   # Full CRUD + stats
│   │   │   ├── financeController.js  # Giving, ledger, summary
│   │   │   └── analyticsController.js # Cross-branch dashboards
│   │   ├── middleware/
│   │   │   ├── auth.js          # JWT verify, RBAC, branch scope
│   │   │   └── errorHandler.js  # Global error + asyncHandler
│   │   ├── routes/              # 19 route files (one per module)
│   │   ├── utils/
│   │   │   └── logger.js        # Winston logger
│   │   └── server.js            # Express app entry point
│   ├── .env.example
│   └── package.json
│
├── database/
│   ├── schema.sql               # Complete PostgreSQL schema (25 tables)
│   ├── migrate.js               # Migration runner
│   └── seed.js                  # Realistic seed data
│
└── package.json                 # Monorepo root
```

---

## Prerequisites

| Tool       | Version  | Install |
|------------|----------|---------|
| Node.js    | ≥ 18.x   | https://nodejs.org |
| npm        | ≥ 9.x    | Comes with Node |
| PostgreSQL | ≥ 14.x   | https://postgresql.org |
| Git        | Any      | https://git-scm.com |

---

## Setup Instructions

### Step 1 — Create the PostgreSQL database

```bash
# Log into PostgreSQL as superuser
psql -U postgres

# Create the database
CREATE DATABASE graceerp;

# Exit psql
\q
```

### Step 2 — Configure the backend environment

```bash
cd backend
cp .env.example .env
```

Open `.env` and fill in your values:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=graceerp
DB_USER=postgres
DB_PASSWORD=your_postgres_password

JWT_SECRET=change_this_to_a_long_random_string_min_32_chars
JWT_REFRESH_SECRET=another_long_random_string_for_refresh_tokens

FRONTEND_URL=http://localhost:2025
PORT=2020
```

### Step 3 — Configure the frontend environment

```bash
cd frontend
cp .env.example .env
```

The default `.env` works for local development:
```env
VITE_API_URL=http://localhost:2020/api
VITE_APP_NAME=GraceERP
```

### Step 4 — Install all dependencies

From the project root:

```bash
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
```

### Step 5 — Run database migration

```bash
cd backend
npm run migrate
```

Expected output:
```
🔄 Running GraceERP database migration...
✅ Migration complete — all tables created.
```

### Step 6 — Seed sample data

```bash
npm run seed
```

Expected output:
```
🌱 Seeding GraceERP database...
  ✓ Users created — default password: GraceERP@2025
  ✓ Sample members created
  ✓ Sample giving records created
  ✓ Sample assets created
  ✓ Sample sermons created
  ✓ Sample budgets created
  ✓ Sample events created
  ✓ Sample staff created

🎉 Database seeded successfully!

📋 Login credentials:
   Super Admin:  admin@clci.org / GraceERP@2025
   Finance:      finance@clci.org / GraceERP@2025
   Branch Admin: lagos.admin@clci.org / GraceERP@2025
   Pastor:       pastor@clci.org / GraceERP@2025
```

### Step 7 — Start the development servers

**Option A — Start both together (from root):**
```bash
npm run dev
```

**Option B — Start individually:**

Terminal 1 (backend):
```bash
cd backend
npm run dev
```

Terminal 2 (frontend):
```bash
cd frontend
npm run dev
```

### Step 8 — Open the application

- **Frontend**: http://localhost:2025
- **API**: http://localhost:2020
- **API Health**: http://localhost:2020/health

---

## API Reference

### Authentication
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/login` | Login with email + password | Public |
| POST | `/api/auth/refresh` | Refresh access token | Public |
| POST | `/api/auth/logout` | Invalidate refresh token | Required |
| GET  | `/api/auth/me` | Get current user profile | Required |
| PUT  | `/api/auth/change-password` | Change password | Required |

### Members
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/members` | List members (paginated, filterable) |
| GET  | `/api/members/stats` | Member statistics |
| GET  | `/api/members/:id` | Get member by ID |
| POST | `/api/members` | Create member |
| PUT  | `/api/members/:id` | Update member |
| DELETE | `/api/members/:id` | Soft-delete member |

### Finance
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/finance/giving` | List giving records |
| GET  | `/api/finance/giving/:id` | Get giving record |
| POST | `/api/finance/giving` | Record giving (auto-creates ledger entry) |
| GET  | `/api/finance/summary` | Giving summary by type + monthly trend |
| GET  | `/api/finance/ledger` | General ledger entries |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/dashboard` | KPI dashboard data |
| GET | `/api/analytics/giving-trend` | Monthly giving trend |
| GET | `/api/analytics/member-growth` | Member growth by branch |
| GET | `/api/analytics/attendance-trend` | Attendance trend |
| GET | `/api/analytics/branch-comparison` | Side-by-side branch KPIs |
| GET | `/api/analytics/content` | Sermon + library analytics |

### All Module Endpoints (scaffolded)
`/api/branches` · `/api/assets` · `/api/sermons` · `/api/library` · `/api/meetings`
· `/api/events` · `/api/pastoral` · `/api/communications` · `/api/hr`
· `/api/facilities` · `/api/documents` · `/api/audit` · `/api/users`

---

## Roles & Access

| Role | Scope | Access Level |
|------|-------|-------------|
| `super_admin` | All branches | Full system access |
| `branch_admin` | Own branch | Full branch access |
| `finance_officer` | Own branch | Finance module only |
| `pastor` | Own branch | Members + pastoral + content |
| `content_manager` | Own branch | Sermons + library |
| `hr_officer` | Own branch | HR module |
| `member` | Own branch | Read-only self-service |

All API routes enforce **branch isolation** — non-super-admins can only read/write their own branch's data at the database query level.

---

## Database Schema (25 tables)

```
churches              — HQ organization record
branches              — Multi-tenant branch records
users                 — System access accounts (with roles)
members               — Full member profiles
attendance            — Service attendance per member
giving_records        — Tithe/offering/seed records
ledger_entries        — Double-entry general ledger
budgets               — Departmental budget allocations
expenditure_requests  — Payment requests with approval workflow
assets                — Asset register with depreciation
asset_maintenance     — Maintenance log per asset
sermons               — Sermon library (audio/video/PDF)
library_resources     — E-library resources with tier access
meetings              — Live/scheduled meetings
meeting_attendance    — Virtual attendance per meeting
events                — Events and programmes
event_rsvps           — RSVP records per event
prayer_requests       — Pastoral care requests
pastoral_visits       — Visitation log
welfare_flags         — Welfare and support flags
messages              — Broadcast communication records
staff                 — Staff and HR records
leave_requests        — Leave applications
facilities            — Rooms/halls per branch
facility_bookings     — Facility reservations
audit_logs            — Immutable system audit trail
```

---

## Building for Production

```bash
# Build the frontend (outputs to backend/public)
cd frontend && npm run build

# Start the backend (serves the built frontend as static files)
cd backend && NODE_ENV=production npm start
```

The backend serves the built React app on the same port, so you only need one server in production.

---

## Deployment

### Environment variables (production)
```env
NODE_ENV=production
DB_SSL=true
JWT_SECRET=<use a 64-char random string>
JWT_REFRESH_SECRET=<use a different 64-char random string>
FRONTEND_URL=https://your-domain.com
```

### Recommended hosting
| Layer | Option |
|-------|--------|
| App server | Railway, Render, AWS EC2, DigitalOcean |
| Database | Railway PostgreSQL, Supabase, AWS RDS |
| File storage | AWS S3 + CloudFront (for media files) |
| CDN | Cloudflare |

---

## Developed By

GraceERP is a product of **Roland Consult** / **Agileware Technologies**, Abuja, Nigeria.

*Built for the Kingdom.*
