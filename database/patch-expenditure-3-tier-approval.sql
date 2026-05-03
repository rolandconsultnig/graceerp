-- Patch: 3-level expenditure approval (run once on existing databases).
--   psql -U postgres -d YOUR_DB -f database/patch-expenditure-3-tier-approval.sql
--
-- Approval chain:
--   1 — Head of department (role: dept_head)
--   2 — Coordinating elder (role: coordinating_elder)
--   3 — Coordinating pastor (role: coordinating_pastor)
-- super_admin / branch_admin may approve any step in their scope.

-- ── Extend user roles ─────────────────────────────────────────────────────────
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN (
  'super_admin',
  'branch_admin',
  'finance_officer',
  'pastor',
  'content_manager',
  'hr_officer',
  'dept_head',
  'coordinating_elder',
  'coordinating_pastor',
  'member'
));

-- ── Expenditure approval audit columns ────────────────────────────────────────
ALTER TABLE expenditure_requests
  ADD COLUMN IF NOT EXISTS hod_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hod_approved_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS elder_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS elder_approved_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS pastor_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pastor_approved_by UUID REFERENCES users(id);

ALTER TABLE expenditure_requests DROP CONSTRAINT IF EXISTS expenditure_requests_status_check;
ALTER TABLE expenditure_requests ADD CONSTRAINT expenditure_requests_status_check CHECK (status IN (
  'pending',
  'hod_approved',
  'elder_approved',
  'approved',
  'rejected',
  'paid',
  'cancelled'
));
