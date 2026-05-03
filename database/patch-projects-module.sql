-- GraceERP: projects + departmental budget submissions (idempotent for existing DBs)
-- Run once against deployments created before this module.

CREATE TABLE IF NOT EXISTS projects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id       UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  code            VARCHAR(30),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  department      VARCHAR(100),
  status          VARCHAR(20) DEFAULT 'planning'
                  CHECK (status IN ('planning','active','on_hold','completed','cancelled')),
  priority        VARCHAR(20) DEFAULT 'medium'
                  CHECK (priority IN ('low','medium','high')),
  start_date      DATE,
  end_date        DATE,
  budget_amount   NUMERIC(15,2),
  spent_amount    NUMERIC(15,2) DEFAULT 0,
  currency        VARCHAR(10) DEFAULT 'NGN',
  owner_user_id   UUID REFERENCES users(id),
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS department_budget_submissions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id           UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  branch_id           UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
  fiscal_year         INTEGER NOT NULL,
  department          VARCHAR(100) NOT NULL,
  title               VARCHAR(255) NOT NULL,
  narrative           TEXT,
  requested_amount    NUMERIC(15,2) NOT NULL,
  currency            VARCHAR(10) DEFAULT 'NGN',
  submitted_by        UUID REFERENCES users(id),
  status              VARCHAR(20) DEFAULT 'draft'
                      CHECK (status IN ('draft','pending','hod_approved','elder_approved','approved','rejected')),
  hod_approved_at     TIMESTAMPTZ,
  hod_approved_by     UUID REFERENCES users(id),
  elder_approved_at   TIMESTAMPTZ,
  elder_approved_by   UUID REFERENCES users(id),
  pastor_approved_at  TIMESTAMPTZ,
  pastor_approved_by  UUID REFERENCES users(id),
  rejection_reason    TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_branch     ON projects(branch_id);
CREATE INDEX IF NOT EXISTS idx_projects_status     ON projects(status);
CREATE INDEX IF NOT EXISTS idx_dept_budget_branch ON department_budget_submissions(branch_id);
CREATE INDEX IF NOT EXISTS idx_dept_budget_year     ON department_budget_submissions(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_dept_budget_status   ON department_budget_submissions(status);

DROP TRIGGER IF EXISTS trg_updated_at ON projects;
CREATE TRIGGER trg_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_updated_at ON department_budget_submissions;
CREATE TRIGGER trg_updated_at
  BEFORE UPDATE ON department_budget_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
