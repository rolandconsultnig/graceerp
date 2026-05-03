-- GraceERP: salvage value for depreciation + maintenance type/vendor/updated_at
-- Requires existing GraceERP schema (update_updated_at function present).

ALTER TABLE assets ADD COLUMN IF NOT EXISTS salvage_value NUMERIC(15,2);

ALTER TABLE asset_maintenance ADD COLUMN IF NOT EXISTS maintenance_type VARCHAR(30) DEFAULT 'general';
ALTER TABLE asset_maintenance ADD COLUMN IF NOT EXISTS vendor VARCHAR(255);
ALTER TABLE asset_maintenance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE asset_maintenance SET maintenance_type = COALESCE(maintenance_type, 'general');

CREATE INDEX IF NOT EXISTS idx_asset_maint_next_due ON asset_maintenance(next_due_date);
CREATE INDEX IF NOT EXISTS idx_asset_maint_asset ON asset_maintenance(asset_id);

DROP TRIGGER IF EXISTS trg_updated_at ON asset_maintenance;
CREATE TRIGGER trg_updated_at
  BEFORE UPDATE ON asset_maintenance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
