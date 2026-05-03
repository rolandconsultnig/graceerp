-- ============================================================
-- GraceERP — Complete Database Schema
-- PostgreSQL 14+
-- Run: psql -U postgres -d graceerp -f schema.sql
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── CHURCHES (HQ level) ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS churches (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  tagline       VARCHAR(500),
  address       TEXT,
  city          VARCHAR(100),
  state         VARCHAR(100),
  country       VARCHAR(100) DEFAULT 'Nigeria',
  phone         VARCHAR(50),
  email         VARCHAR(255),
  website       VARCHAR(255),
  logo_url      VARCHAR(500),
  currency      VARCHAR(10) DEFAULT 'NGN',
  founded_year  INTEGER,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── BRANCHES ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id       UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  code            VARCHAR(20) UNIQUE,
  address         TEXT,
  city            VARCHAR(100),
  state           VARCHAR(100),
  country         VARCHAR(100) DEFAULT 'Nigeria',
  phone           VARCHAR(50),
  email           VARCHAR(255),
  service_schedule VARCHAR(500),
  capacity        INTEGER,
  is_headquarters BOOLEAN DEFAULT FALSE,
  status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','pending','suspended','archived')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── USERS (system access) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id       UUID NOT NULL REFERENCES churches(id),
  branch_id       UUID REFERENCES branches(id),
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  full_name       VARCHAR(255) NOT NULL,
  role            VARCHAR(50) NOT NULL DEFAULT 'member'
                  CHECK (role IN ('super_admin','branch_admin','finance_officer',
                                  'pastor','content_manager','hr_officer',
                                  'dept_head','coordinating_elder','coordinating_pastor','member')),
  is_active       BOOLEAN DEFAULT TRUE,
  last_login      TIMESTAMPTZ,
  refresh_token   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── MEMBERS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS members (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id         UUID NOT NULL REFERENCES churches(id),
  branch_id         UUID NOT NULL REFERENCES branches(id),
  user_id           UUID REFERENCES users(id),
  member_code       VARCHAR(20) UNIQUE,
  first_name        VARCHAR(100) NOT NULL,
  last_name         VARCHAR(100) NOT NULL,
  middle_name       VARCHAR(100),
  email             VARCHAR(255),
  phone             VARCHAR(50),
  date_of_birth     DATE,
  gender            VARCHAR(10) CHECK (gender IN ('male','female','other')),
  marital_status    VARCHAR(20),
  occupation        VARCHAR(255),
  address           TEXT,
  city              VARCHAR(100),
  state             VARCHAR(100),
  photo_url         VARCHAR(500),
  salvation_date    DATE,
  baptism_date      DATE,
  membership_date   DATE,
  tier              VARCHAR(50) DEFAULT 'general_member'
                    CHECK (tier IN ('general_member','cell_leader','deacon',
                                    'deaconess','minister','pastor',
                                    'exec_pastor','bishop')),
  department        VARCHAR(100),
  cell_group        VARCHAR(100),
  assigned_pastor_id UUID REFERENCES members(id),
  household_head_id UUID REFERENCES members(id),
  emergency_contact_name  VARCHAR(255),
  emergency_contact_phone VARCHAR(50),
  status            VARCHAR(20) DEFAULT 'active'
                    CHECK (status IN ('active','inactive','transferred','deceased')),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── ATTENDANCE ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id     UUID NOT NULL REFERENCES churches(id),
  branch_id     UUID NOT NULL REFERENCES branches(id),
  member_id     UUID REFERENCES members(id),
  service_type  VARCHAR(100) NOT NULL,
  service_date  DATE NOT NULL,
  check_in_time TIMESTAMPTZ DEFAULT NOW(),
  check_in_method VARCHAR(20) DEFAULT 'manual'
                  CHECK (check_in_method IN ('qr_code','manual','biometric','online')),
  is_first_timer BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── GIVING / FINANCE ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS giving_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id       UUID NOT NULL REFERENCES churches(id),
  branch_id       UUID NOT NULL REFERENCES branches(id),
  member_id       UUID REFERENCES members(id),
  giving_type     VARCHAR(50) NOT NULL
                  CHECK (giving_type IN ('tithe','offering','special_seed',
                                         'project_fund','welfare','missions','other')),
  amount          NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  currency        VARCHAR(10) DEFAULT 'NGN',
  payment_method  VARCHAR(30) DEFAULT 'cash'
                  CHECK (payment_method IN ('cash','bank_transfer','pos',
                                            'online_paystack','online_flutterwave','cheque')),
  transaction_ref VARCHAR(255),
  receipt_number  VARCHAR(50) UNIQUE,
  giving_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  recorded_by     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── GENERAL LEDGER ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ledger_entries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id       UUID NOT NULL REFERENCES churches(id),
  branch_id       UUID NOT NULL REFERENCES branches(id),
  entry_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  description     VARCHAR(500) NOT NULL,
  debit_account   VARCHAR(100) NOT NULL,
  credit_account  VARCHAR(100) NOT NULL,
  amount          NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  currency        VARCHAR(10) DEFAULT 'NGN',
  reference_id    UUID,
  reference_type  VARCHAR(50),
  is_reversed     BOOLEAN DEFAULT FALSE,
  reversal_of     UUID REFERENCES ledger_entries(id),
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── BUDGETS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id       UUID NOT NULL REFERENCES churches(id),
  branch_id       UUID NOT NULL REFERENCES branches(id),
  fiscal_year     INTEGER NOT NULL,
  department      VARCHAR(100) NOT NULL,
  total_amount    NUMERIC(15,2) NOT NULL,
  currency        VARCHAR(10) DEFAULT 'NGN',
  description     TEXT,
  approved_by     UUID REFERENCES users(id),
  status          VARCHAR(20) DEFAULT 'draft'
                  CHECK (status IN ('draft','approved','active','closed')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── EXPENDITURE REQUESTS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenditure_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id       UUID NOT NULL REFERENCES churches(id),
  branch_id       UUID NOT NULL REFERENCES branches(id),
  budget_id       UUID REFERENCES budgets(id),
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  amount          NUMERIC(15,2) NOT NULL,
  currency        VARCHAR(10) DEFAULT 'NGN',
  department      VARCHAR(100),
  requested_by    UUID REFERENCES users(id),
  approved_by     UUID REFERENCES users(id),
  hod_approved_at    TIMESTAMPTZ,
  hod_approved_by    UUID REFERENCES users(id),
  elder_approved_at  TIMESTAMPTZ,
  elder_approved_by  UUID REFERENCES users(id),
  pastor_approved_at TIMESTAMPTZ,
  pastor_approved_by UUID REFERENCES users(id),
  status          VARCHAR(20) DEFAULT 'pending'
                  CHECK (status IN ('pending','hod_approved','elder_approved','approved','rejected','paid','cancelled')),
  rejection_reason TEXT,
  payment_date    DATE,
  payment_method  VARCHAR(30),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── ASSETS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assets (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id         UUID NOT NULL REFERENCES churches(id),
  branch_id         UUID NOT NULL REFERENCES branches(id),
  asset_tag         VARCHAR(50) UNIQUE NOT NULL,
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  category          VARCHAR(50) NOT NULL
                    CHECK (category IN ('vehicle','equipment','instrument','it',
                                        'furniture','building','land','other')),
  serial_number     VARCHAR(100),
  purchase_date     DATE,
  purchase_cost     NUMERIC(15,2),
  current_value     NUMERIC(15,2),
  salvage_value     NUMERIC(15,2),
  currency          VARCHAR(10) DEFAULT 'NGN',
  depreciation_method VARCHAR(20) DEFAULT 'straight_line'
                    CHECK (depreciation_method IN ('straight_line','reducing_balance','none')),
  useful_life_years INTEGER,
  location          VARCHAR(255),
  custodian_id      UUID REFERENCES members(id),
  insurance_policy  VARCHAR(100),
  insurance_expiry  DATE,
  status            VARCHAR(20) DEFAULT 'active'
                    CHECK (status IN ('active','maintenance','disposed','transferred')),
  photo_url         VARCHAR(500),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_maintenance (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id      UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  maintenance_date DATE NOT NULL,
  description   TEXT NOT NULL,
  maintenance_type VARCHAR(30) DEFAULT 'general'
                  CHECK (maintenance_type IN (
                    'general','preventive','corrective','inspection','calibration','repair','other'
                  )),
  cost          NUMERIC(15,2),
  vendor        VARCHAR(255),
  performed_by  VARCHAR(255),
  next_due_date DATE,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── SERMONS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sermons (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id       UUID NOT NULL REFERENCES churches(id),
  branch_id       UUID REFERENCES branches(id),
  title           VARCHAR(500) NOT NULL,
  preacher_name   VARCHAR(255) NOT NULL,
  series          VARCHAR(255),
  scripture_ref   VARCHAR(255),
  sermon_date     DATE NOT NULL,
  duration_minutes INTEGER,
  description     TEXT,
  tags            TEXT[],
  audio_url       VARCHAR(500),
  video_url       VARCHAR(500),
  transcript_url  VARCHAR(500),
  thumbnail_url   VARCHAR(500),
  download_allowed BOOLEAN DEFAULT TRUE,
  access_tier     VARCHAR(50) DEFAULT 'all'
                  CHECK (access_tier IN ('all','cell_leader','minister','pastor','admin')),
  play_count      INTEGER DEFAULT 0,
  download_count  INTEGER DEFAULT 0,
  language        VARCHAR(50) DEFAULT 'English',
  uploaded_by     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── E-LIBRARY ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS library_resources (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id       UUID NOT NULL REFERENCES churches(id),
  title           VARCHAR(500) NOT NULL,
  author          VARCHAR(255),
  description     TEXT,
  category        VARCHAR(100),
  format          VARCHAR(20) DEFAULT 'pdf'
                  CHECK (format IN ('pdf','epub','docx','mp3','mp4','other')),
  file_url        VARCHAR(500),
  file_size_bytes BIGINT,
  cover_url       VARCHAR(500),
  access_tier     VARCHAR(50) DEFAULT 'all'
                  CHECK (access_tier IN ('all','cell_leader','minister','pastor','admin')),
  download_allowed BOOLEAN DEFAULT FALSE,
  view_count      INTEGER DEFAULT 0,
  tags            TEXT[],
  uploaded_by     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── MEETINGS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meetings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id       UUID NOT NULL REFERENCES churches(id),
  branch_id       UUID REFERENCES branches(id),
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  meeting_type    VARCHAR(50),
  host_name       VARCHAR(255),
  host_user_id    UUID REFERENCES users(id),
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end   TIMESTAMPTZ,
  actual_start    TIMESTAMPTZ,
  actual_end      TIMESTAMPTZ,
  platform        VARCHAR(50) DEFAULT 'jitsi',
  meeting_url     VARCHAR(500),
  recording_url   VARCHAR(500),
  is_public       BOOLEAN DEFAULT TRUE,
  access_tier     VARCHAR(50) DEFAULT 'all',
  max_attendees   INTEGER,
  status          VARCHAR(20) DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled','live','ended','cancelled')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_attendance (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id  UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  member_id   UUID REFERENCES members(id),
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  left_at     TIMESTAMPTZ,
  display_name VARCHAR(255)
);

-- ── EVENTS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id       UUID NOT NULL REFERENCES churches(id),
  branch_id       UUID NOT NULL REFERENCES branches(id),
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  event_type      VARCHAR(50),
  venue           VARCHAR(255),
  event_date      DATE NOT NULL,
  start_time      TIME,
  end_time        TIME,
  capacity        INTEGER,
  rsvp_required   BOOLEAN DEFAULT TRUE,
  rsvp_count      INTEGER DEFAULT 0,
  is_recurring    BOOLEAN DEFAULT FALSE,
  recurrence_rule VARCHAR(100),
  flyer_url       VARCHAR(500),
  status          VARCHAR(20) DEFAULT 'upcoming'
                  CHECK (status IN ('upcoming','ongoing','completed','cancelled')),
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_rsvps (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id   UUID REFERENCES members(id),
  name        VARCHAR(255),
  email       VARCHAR(255),
  phone       VARCHAR(50),
  status      VARCHAR(20) DEFAULT 'confirmed'
              CHECK (status IN ('confirmed','waitlisted','cancelled')),
  checked_in  BOOLEAN DEFAULT FALSE,
  checked_in_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── PASTORAL CARE ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prayer_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id       UUID NOT NULL REFERENCES churches(id),
  branch_id       UUID NOT NULL REFERENCES branches(id),
  member_id       UUID REFERENCES members(id),
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  is_confidential BOOLEAN DEFAULT FALSE,
  priority        VARCHAR(20) DEFAULT 'medium'
                  CHECK (priority IN ('low','medium','high','urgent')),
  assigned_to     UUID REFERENCES users(id),
  status          VARCHAR(20) DEFAULT 'open'
                  CHECK (status IN ('open','in_progress','resolved','closed')),
  resolved_at     TIMESTAMPTZ,
  resolution_note TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pastoral_visits (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id     UUID NOT NULL REFERENCES churches(id),
  branch_id     UUID NOT NULL REFERENCES branches(id),
  member_id     UUID NOT NULL REFERENCES members(id),
  visited_by    UUID NOT NULL REFERENCES users(id),
  visit_date    DATE NOT NULL,
  purpose       VARCHAR(255),
  notes         TEXT,
  follow_up_date DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS welfare_flags (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id       UUID NOT NULL REFERENCES churches(id),
  branch_id       UUID NOT NULL REFERENCES branches(id),
  member_id       UUID NOT NULL REFERENCES members(id),
  flag_type       VARCHAR(50)
                  CHECK (flag_type IN ('financial','medical','emotional','bereavement','other')),
  description     TEXT,
  assigned_to     UUID REFERENCES users(id),
  status          VARCHAR(20) DEFAULT 'open'
                  CHECK (status IN ('open','in_progress','resolved')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── COMMUNICATIONS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id       UUID NOT NULL REFERENCES churches(id),
  branch_id       UUID REFERENCES branches(id),
  title           VARCHAR(255) NOT NULL,
  body            TEXT NOT NULL,
  channel         VARCHAR(30) NOT NULL
                  CHECK (channel IN ('sms','email','push','whatsapp','in_app','all')),
  audience_type   VARCHAR(30) DEFAULT 'all'
                  CHECK (audience_type IN ('all','branch','department','tier','custom','individual')),
  audience_filter JSONB,
  sent_count      INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count      INTEGER DEFAULT 0,
  status          VARCHAR(20) DEFAULT 'draft'
                  CHECK (status IN ('draft','scheduled','sending','sent','failed')),
  scheduled_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── HR / STAFF ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id       UUID NOT NULL REFERENCES churches(id),
  branch_id       UUID NOT NULL REFERENCES branches(id),
  member_id       UUID REFERENCES members(id),
  employee_number VARCHAR(30) UNIQUE,
  full_name       VARCHAR(255) NOT NULL,
  email           VARCHAR(255),
  phone           VARCHAR(50),
  role_title      VARCHAR(255),
  department      VARCHAR(100),
  employment_type VARCHAR(20) DEFAULT 'full_time'
                  CHECK (employment_type IN ('full_time','part_time','contract','volunteer')),
  start_date      DATE,
  end_date        DATE,
  monthly_salary  NUMERIC(15,2),
  currency        VARCHAR(10) DEFAULT 'NGN',
  bank_name       VARCHAR(100),
  account_number  VARCHAR(30),
  manager_id      UUID REFERENCES staff(id),
  leave_balance   INTEGER DEFAULT 20,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id      UUID NOT NULL REFERENCES staff(id),
  leave_type    VARCHAR(30) DEFAULT 'annual'
                CHECK (leave_type IN ('annual','sick','compassionate','maternity','paternity','unpaid')),
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  days_requested INTEGER,
  reason        TEXT,
  approved_by   UUID REFERENCES users(id),
  status        VARCHAR(20) DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected','cancelled')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── FACILITIES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facilities (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id     UUID NOT NULL REFERENCES churches(id),
  branch_id     UUID NOT NULL REFERENCES branches(id),
  name          VARCHAR(255) NOT NULL,
  facility_type VARCHAR(50),
  capacity      INTEGER,
  description   TEXT,
  amenities     TEXT[],
  photo_url     VARCHAR(500),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS facility_bookings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facility_id     UUID NOT NULL REFERENCES facilities(id),
  booked_by       UUID REFERENCES users(id),
  event_name      VARCHAR(255),
  booking_date    DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  setup_mins      INTEGER DEFAULT 30,
  teardown_mins   INTEGER DEFAULT 30,
  attendee_count  INTEGER,
  purpose         TEXT,
  status          VARCHAR(20) DEFAULT 'pending'
                  CHECK (status IN ('pending','confirmed','cancelled')),
  approved_by     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── DOCUMENTS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id       UUID NOT NULL REFERENCES churches(id),
  branch_id       UUID REFERENCES branches(id),
  title           VARCHAR(500) NOT NULL,
  document_type   VARCHAR(50),
  category        VARCHAR(100),
  file_url        VARCHAR(500),
  file_size_bytes BIGINT,
  version         INTEGER DEFAULT 1,
  access_role     VARCHAR(50) DEFAULT 'branch_admin',
  tags            TEXT[],
  expiry_date     DATE,
  uploaded_by     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── MEMBER PORTAL (profile chat — congregation-facing app) ────────────────────
CREATE TABLE IF NOT EXISTS member_portal_chat_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id       UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  is_staff        BOOLEAN NOT NULL DEFAULT FALSE,
  staff_user_id   UUID REFERENCES users(id),
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_portal_chat_member ON member_portal_chat_messages(member_id, created_at);
CREATE INDEX IF NOT EXISTS idx_member_portal_chat_church ON member_portal_chat_messages(church_id);

-- ── AUDIT LOG ─────────────────────────────────────────────────────────────────
-- ── PROJECT MANAGEMENT ───────────────────────────────────────────────────────
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

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id     UUID REFERENCES churches(id),
  branch_id     UUID REFERENCES branches(id),
  user_id       UUID REFERENCES users(id),
  action        VARCHAR(50) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id   UUID,
  old_values    JSONB,
  new_values    JSONB,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_members_church    ON members(church_id);
CREATE INDEX IF NOT EXISTS idx_members_branch    ON members(branch_id);
CREATE INDEX IF NOT EXISTS idx_members_status    ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_tier      ON members(tier);
CREATE INDEX IF NOT EXISTS idx_giving_church     ON giving_records(church_id);
CREATE INDEX IF NOT EXISTS idx_giving_branch     ON giving_records(branch_id);
CREATE INDEX IF NOT EXISTS idx_giving_member     ON giving_records(member_id);
CREATE INDEX IF NOT EXISTS idx_giving_date       ON giving_records(giving_date);
CREATE INDEX IF NOT EXISTS idx_assets_church     ON assets(church_id);
CREATE INDEX IF NOT EXISTS idx_assets_branch     ON assets(branch_id);
CREATE INDEX IF NOT EXISTS idx_assets_status     ON assets(status);
CREATE INDEX IF NOT EXISTS idx_asset_maint_next_due ON asset_maintenance(next_due_date);
CREATE INDEX IF NOT EXISTS idx_asset_maint_asset    ON asset_maintenance(asset_id);
CREATE INDEX IF NOT EXISTS idx_sermons_church    ON sermons(church_id);
CREATE INDEX IF NOT EXISTS idx_sermons_date      ON sermons(sermon_date);
CREATE INDEX IF NOT EXISTS idx_audit_church      ON audit_logs(church_id);
CREATE INDEX IF NOT EXISTS idx_audit_user        ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created     ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_projects_branch     ON projects(branch_id);
CREATE INDEX IF NOT EXISTS idx_projects_status     ON projects(status);
CREATE INDEX IF NOT EXISTS idx_dept_budget_branch ON department_budget_submissions(branch_id);
CREATE INDEX IF NOT EXISTS idx_dept_budget_year     ON department_budget_submissions(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_dept_budget_status   ON department_budget_submissions(status);
CREATE INDEX IF NOT EXISTS idx_attendance_date   ON attendance(service_date);
CREATE INDEX IF NOT EXISTS idx_attendance_member ON attendance(member_id);

-- ── UPDATED_AT TRIGGER ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'churches','branches','users','members','giving_records','budgets',
    'expenditure_requests','assets','sermons','library_resources','meetings',
    'events','prayer_requests','welfare_flags','staff','leave_requests','documents',
    'projects','department_budget_submissions','asset_maintenance'
  ]) LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_updated_at ON %I;
       CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at();', tbl, tbl);
  END LOOP;
END $$;
