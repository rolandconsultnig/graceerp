const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');
const { attachDepreciation } = require('../utils/assetDepreciation');

const CATEGORIES = ['vehicle', 'equipment', 'instrument', 'it', 'furniture', 'building', 'land', 'other'];
const DEPREC = ['straight_line', 'reducing_balance', 'none'];
const STATUSES = ['active', 'maintenance', 'disposed', 'transferred'];
const MAINT_TYPES = ['general', 'preventive', 'corrective', 'inspection', 'calibration', 'repair', 'other'];

function enrichRows(rows) {
  return rows.map((r) => attachDepreciation(r));
}

exports.list = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { page = 1, limit = 20, search, category, status } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  const offset = (parseInt(page, 10) - 1) * lim;

  const conditions = [`a.church_id = $1`];
  const params = [churchId];
  let pi = 2;

  if (req.branchId) {
    conditions.push(`a.branch_id = $${pi++}`);
    params.push(req.branchId);
  }

  if (category && CATEGORIES.includes(category)) {
    conditions.push(`a.category = $${pi++}`);
    params.push(category);
  }

  if (status && STATUSES.includes(status)) {
    conditions.push(`a.status = $${pi++}`);
    params.push(status);
  }

  if (search) {
    conditions.push(`(a.name ILIKE $${pi} OR a.asset_tag ILIKE $${pi} OR a.serial_number ILIKE $${pi})`);
    params.push(`%${search}%`);
    pi++;
  }

  const where = conditions.join(' AND ');
  const countRes = await query(`SELECT COUNT(*) FROM assets a WHERE ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const result = await query(
    `SELECT a.*, b.name AS branch_name,
            m.first_name AS custodian_first, m.last_name AS custodian_last
     FROM assets a
     JOIN branches b ON a.branch_id = b.id
     LEFT JOIN members m ON a.custodian_id = m.id
     WHERE ${where}
     ORDER BY a.created_at DESC
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, lim, offset]
  );

  res.json({
    success: true,
    data: enrichRows(result.rows),
    pagination: { page: parseInt(page, 10), limit: lim, total, pages: Math.ceil(total / lim) || 1 },
  });
});

exports.getOne = asyncHandler(async (req, res) => {
  const scoped = req.branchId ? ` AND a.branch_id = $3` : '';
  const params = req.branchId ? [req.params.id, req.user.church_id, req.branchId] : [req.params.id, req.user.church_id];

  const result = await query(
    `SELECT a.*, b.name AS branch_name
     FROM assets a JOIN branches b ON a.branch_id = b.id
     WHERE a.id = $1 AND a.church_id = $2 ${scoped}`,
    params
  );

  if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: attachDepreciation(result.rows[0]) });
});

exports.create = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const body = req.body;

  if (!body.asset_tag?.trim() || !body.name?.trim()) {
    return res.status(400).json({ success: false, message: 'asset_tag and name required' });
  }

  let bid = body.branch_id || req.branchId;
  if (!bid) return res.status(400).json({ success: false, message: 'branch_id required' });

  const bchk = await query(`SELECT id FROM branches WHERE id=$1 AND church_id=$2`, [bid, churchId]);
  if (!bchk.rows.length) return res.status(400).json({ success: false, message: 'Invalid branch' });

  const cat = CATEGORIES.includes(body.category) ? body.category : 'other';
  const dep = DEPREC.includes(body.depreciation_method) ? body.depreciation_method : 'straight_line';
  const st = STATUSES.includes(body.status) ? body.status : 'active';

  try {
    const ins = await query(
      `INSERT INTO assets (
        church_id, branch_id, asset_tag, name, description, category, serial_number,
        purchase_date, purchase_cost, current_value, salvage_value, currency, depreciation_method,
        useful_life_years, location, custodian_id, insurance_policy, insurance_expiry,
        status, photo_url
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *`,
      [
        churchId,
        bid,
        body.asset_tag.trim(),
        body.name.trim(),
        body.description || null,
        cat,
        body.serial_number?.trim() || null,
        body.purchase_date || null,
        body.purchase_cost ?? null,
        body.current_value ?? null,
        body.salvage_value ?? null,
        body.currency || 'NGN',
        dep,
        body.useful_life_years ?? null,
        body.location?.trim() || null,
        body.custodian_id || null,
        body.insurance_policy?.trim() || null,
        body.insurance_expiry || null,
        st,
        body.photo_url?.trim() || null,
      ]
    );
    res.status(201).json({ success: true, data: attachDepreciation(ins.rows[0]) });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ success: false, message: 'Asset tag already exists' });
    throw e;
  }
});

exports.update = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { id } = req.params;

  const allowed = [
    'branch_id',
    'asset_tag',
    'name',
    'description',
    'category',
    'serial_number',
    'purchase_date',
    'purchase_cost',
    'current_value',
    'salvage_value',
    'currency',
    'depreciation_method',
    'useful_life_years',
    'location',
    'custodian_id',
    'insurance_policy',
    'insurance_expiry',
    'status',
    'photo_url',
  ];

  const patch = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, k)) patch[k] = req.body[k];
  }

  if (patch.category != null && !CATEGORIES.includes(patch.category)) delete patch.category;
  if (patch.depreciation_method != null && !DEPREC.includes(patch.depreciation_method)) delete patch.depreciation_method;
  if (patch.status != null && !STATUSES.includes(patch.status)) delete patch.status;

  if (patch.branch_id) {
    const chk = await query(`SELECT id FROM branches WHERE id=$1 AND church_id=$2`, [patch.branch_id, churchId]);
    if (!chk.rows.length) return res.status(400).json({ success: false, message: 'Invalid branch' });
  }

  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  if (!keys.length) {
    const cur = await query(`SELECT * FROM assets WHERE id=$1 AND church_id=$2`, [id, churchId]);
    if (!cur.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, data: attachDepreciation(cur.rows[0]) });
  }

  const sets = [];
  const vals = [];
  let i = 1;
  for (const k of keys) {
    sets.push(`${k} = $${i++}`);
    vals.push(patch[k]);
  }
  sets.push('updated_at = NOW()');
  const idPh = i;
  const churchPh = i + 1;
  vals.push(id, churchId);

  try {
    const upd = await query(
      `UPDATE assets SET ${sets.join(', ')} WHERE id = $${idPh} AND church_id = $${churchPh} RETURNING *`,
      vals
    );
    if (!upd.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: attachDepreciation(upd.rows[0]) });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ success: false, message: 'Asset tag already exists' });
    throw e;
  }
});

exports.remove = asyncHandler(async (req, res) => {
  const r = await query(`DELETE FROM assets WHERE id=$1 AND church_id=$2 RETURNING id`, [req.params.id, req.user.church_id]);
  if (!r.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, message: 'Deleted' });
});

exports.listMaintenance = asyncHandler(async (req, res) => {
  const assetId = req.params.id;
  const chk = await query(`SELECT id FROM assets WHERE id=$1 AND church_id=$2`, [assetId, req.user.church_id]);
  if (!chk.rows.length) return res.status(404).json({ success: false, message: 'Asset not found' });

  if (req.branchId) {
    const br = await query(`SELECT branch_id FROM assets WHERE id=$1 AND church_id=$2`, [assetId, req.user.church_id]);
    if (br.rows[0]?.branch_id !== req.branchId) return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const rows = await query(
    `SELECT * FROM asset_maintenance WHERE asset_id=$1 ORDER BY maintenance_date DESC, created_at DESC`,
    [assetId]
  );
  res.json({ success: true, data: rows.rows });
});

exports.listUpcomingMaintenance = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const conditions = [`a.church_id = $1`, `m.next_due_date IS NOT NULL`];
  const params = [churchId];
  let pi = 2;

  if (req.branchId) {
    conditions.push(`a.branch_id = $${pi++}`);
    params.push(req.branchId);
  }

  const where = conditions.join(' AND ');
  const result = await query(
    `SELECT m.id, m.asset_id, m.maintenance_date, m.description, m.maintenance_type, m.cost, m.vendor,
            m.performed_by, m.next_due_date, m.created_at,
            a.asset_tag, a.name AS asset_name, b.name AS branch_name
     FROM asset_maintenance m
     JOIN assets a ON m.asset_id = a.id
     JOIN branches b ON a.branch_id = b.id
     WHERE ${where}
     ORDER BY m.next_due_date ASC NULLS LAST
     LIMIT 300`,
    params
  );

  res.json({ success: true, data: result.rows });
});

exports.listMaintenanceHistory = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { page = 1, limit = 25, asset_id, maintenance_type } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 25, 100);
  const offset = (parseInt(page, 10) - 1) * lim;

  const conditions = [`a.church_id = $1`];
  const params = [churchId];
  let pi = 2;

  if (req.branchId) {
    conditions.push(`a.branch_id = $${pi++}`);
    params.push(req.branchId);
  }

  if (asset_id) {
    conditions.push(`m.asset_id = $${pi++}`);
    params.push(asset_id);
  }

  if (maintenance_type && MAINT_TYPES.includes(maintenance_type)) {
    conditions.push(`m.maintenance_type = $${pi++}`);
    params.push(maintenance_type);
  }

  const where = conditions.join(' AND ');
  const countRes = await query(
    `SELECT COUNT(*) FROM asset_maintenance m JOIN assets a ON m.asset_id = a.id WHERE ${where}`,
    params
  );
  const total = parseInt(countRes.rows[0].count, 10);

  const result = await query(
    `SELECT m.*, a.asset_tag, a.name AS asset_name, b.name AS branch_name
     FROM asset_maintenance m
     JOIN assets a ON m.asset_id = a.id
     JOIN branches b ON a.branch_id = b.id
     WHERE ${where}
     ORDER BY m.maintenance_date DESC, m.created_at DESC
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, lim, offset]
  );

  res.json({
    success: true,
    data: result.rows,
    pagination: { page: parseInt(page, 10), limit: lim, total, pages: Math.ceil(total / lim) || 1 },
  });
});

exports.addMaintenance = asyncHandler(async (req, res) => {
  const assetId = req.params.id;
  const {
    maintenance_date,
    description,
    maintenance_type,
    cost,
    vendor,
    performed_by,
    next_due_date,
    flag_asset_under_maintenance,
  } = req.body;

  const chk = await query(`SELECT id FROM assets WHERE id=$1 AND church_id=$2`, [assetId, req.user.church_id]);
  if (!chk.rows.length) return res.status(404).json({ success: false, message: 'Asset not found' });

  if (req.branchId) {
    const br = await query(`SELECT branch_id FROM assets WHERE id=$1`, [assetId]);
    if (br.rows[0]?.branch_id !== req.branchId) return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  if (!maintenance_date || !description?.trim()) {
    return res.status(400).json({ success: false, message: 'maintenance_date and description required' });
  }

  const mt = MAINT_TYPES.includes(maintenance_type) ? maintenance_type : 'general';

  const ins = await query(
    `INSERT INTO asset_maintenance (
       asset_id, maintenance_date, description, maintenance_type, cost, vendor,
       performed_by, next_due_date, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      assetId,
      maintenance_date,
      description.trim(),
      mt,
      cost ?? null,
      vendor?.trim() || null,
      performed_by?.trim() || null,
      next_due_date || null,
      req.user.id,
    ]
  );

  if (flag_asset_under_maintenance === true) {
    await query(`UPDATE assets SET status='maintenance', updated_at=NOW() WHERE id=$1`, [assetId]);
  }

  res.status(201).json({ success: true, data: ins.rows[0] });
});

exports.updateMaintenance = asyncHandler(async (req, res) => {
  const { id: assetId, mid } = req.params;
  const churchId = req.user.church_id;

  const cur = await query(
    `SELECT m.* FROM asset_maintenance m
     JOIN assets a ON m.asset_id = a.id
     WHERE m.id = $1 AND m.asset_id = $2 AND a.church_id = $3`,
    [mid, assetId, churchId]
  );
  if (!cur.rows.length) return res.status(404).json({ success: false, message: 'Not found' });

  if (req.branchId) {
    const br = await query(`SELECT branch_id FROM assets WHERE id=$1`, [assetId]);
    if (br.rows[0]?.branch_id !== req.branchId) return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const body = req.body;
  const allowed = ['maintenance_date', 'description', 'maintenance_type', 'cost', 'vendor', 'performed_by', 'next_due_date'];
  const patch = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, k)) patch[k] = body[k];
  }

  if (patch.maintenance_type != null && !MAINT_TYPES.includes(patch.maintenance_type)) delete patch.maintenance_type;
  if (patch.description != null) patch.description = String(patch.description).trim();

  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  if (!keys.length) return res.json({ success: true, data: cur.rows[0] });

  const sets = [];
  const vals = [];
  let i = 1;
  for (const k of keys) {
    sets.push(`${k} = $${i++}`);
    vals.push(patch[k]);
  }
  sets.push('updated_at = NOW()');
  const idPh = i;
  vals.push(mid);

  const upd = await query(
    `UPDATE asset_maintenance SET ${sets.join(', ')} WHERE id = $${idPh} RETURNING *`,
    vals
  );
  res.json({ success: true, data: upd.rows[0] });
});

exports.deleteMaintenance = asyncHandler(async (req, res) => {
  const { id: assetId, mid } = req.params;
  const churchId = req.user.church_id;

  const cur = await query(
    `SELECT m.id FROM asset_maintenance m
     JOIN assets a ON m.asset_id = a.id
     WHERE m.id = $1 AND m.asset_id = $2 AND a.church_id = $3`,
    [mid, assetId, churchId]
  );
  if (!cur.rows.length) return res.status(404).json({ success: false, message: 'Not found' });

  if (req.branchId) {
    const br = await query(`SELECT branch_id FROM assets WHERE id=$1`, [assetId]);
    if (br.rows[0]?.branch_id !== req.branchId) return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  await query(`DELETE FROM asset_maintenance WHERE id=$1`, [mid]);
  res.json({ success: true, message: 'Deleted' });
});
