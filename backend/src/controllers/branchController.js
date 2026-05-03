const { query, getClient } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

const LIST_FIELDS = `
  id, church_id, name, code, address, city, state, country, phone, email,
  service_schedule, capacity, is_headquarters, status, created_at, updated_at`;

// GET /api/branches
exports.list = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

  let statusClause = `AND status = 'active'`;
  if (req.user.role === 'super_admin' && String(req.query.include_all_statuses) === 'true') {
    statusClause = '';
  }

  const params = [churchId];
  let sql = `
    SELECT ${LIST_FIELDS}
    FROM branches
    WHERE church_id = $1 ${statusClause}`;

  if (req.user.role !== 'super_admin' && req.user.branch_id) {
    sql += ` AND id = $${params.length + 1}`;
    params.push(req.user.branch_id);
  }

  sql += ` ORDER BY is_headquarters DESC NULLS LAST, name ASC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await query(sql, params);
  res.json({ success: true, data: result.rows });
});

// GET /api/branches/:id
exports.getOne = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const churchId = req.user.church_id;

  const result = await query(
    `SELECT ${LIST_FIELDS}
     FROM branches WHERE id = $1 AND church_id = $2`,
    [id, churchId]
  );
  if (!result.rows.length) {
    return res.status(404).json({ success: false, message: 'Branch not found' });
  }
  const row = result.rows[0];

  if (req.user.role !== 'super_admin') {
    if (!req.user.branch_id || req.user.branch_id !== id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
  }

  res.json({ success: true, data: row });
});

// POST /api/branches
exports.create = asyncHandler(async (req, res) => {
  const {
    name,
    code,
    address,
    city,
    state,
    country,
    phone,
    email,
    service_schedule,
    capacity,
    is_headquarters,
    status,
  } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, message: 'Branch name is required' });
  }

  const churchId = req.user.church_id;
  const hq = !!is_headquarters;
  const st = status && ['active', 'pending', 'suspended', 'archived'].includes(status) ? status : 'active';

  const client = await getClient();
  try {
    await client.query('BEGIN');

    if (hq) {
      await client.query(
        `UPDATE branches SET is_headquarters = FALSE, updated_at = NOW() WHERE church_id = $1`,
        [churchId]
      );
    }

    const ins = await client.query(
      `INSERT INTO branches (
        church_id, name, code, address, city, state, country, phone, email,
        service_schedule, capacity, is_headquarters, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING ${LIST_FIELDS}`,
      [
        churchId,
        name.trim(),
        code ? String(code).trim() || null : null,
        address || null,
        city || null,
        state || null,
        country || 'Nigeria',
        phone || null,
        email || null,
        service_schedule || null,
        capacity != null ? parseInt(capacity, 10) : null,
        hq,
        st,
      ]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: ins.rows[0] });
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') {
      return res.status(409).json({ success: false, message: 'Branch code already in use' });
    }
    throw e;
  } finally {
    client.release();
  }
});

// PUT /api/branches/:id
exports.update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const churchId = req.user.church_id;

  const existing = await query(
    `SELECT id FROM branches WHERE id = $1 AND church_id = $2`,
    [id, churchId]
  );
  if (!existing.rows.length) {
    return res.status(404).json({ success: false, message: 'Branch not found' });
  }

  const allowed = [
    'name',
    'code',
    'address',
    'city',
    'state',
    'country',
    'phone',
    'email',
    'service_schedule',
    'capacity',
    'is_headquarters',
    'status',
  ];

  const patch = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, k)) patch[k] = req.body[k];
  }

  if (patch.status && !['active', 'pending', 'suspended', 'archived'].includes(patch.status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    if (patch.is_headquarters === true) {
      await client.query(
        `UPDATE branches SET is_headquarters = FALSE, updated_at = NOW()
         WHERE church_id = $1 AND id <> $2`,
        [churchId, id]
      );
    }

    const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
    if (keys.length === 0) {
      await client.query('ROLLBACK');
      const fresh = await query(
        `SELECT ${LIST_FIELDS} FROM branches WHERE id = $1 AND church_id = $2`,
        [id, churchId]
      );
      res.json({ success: true, data: fresh.rows[0] });
      return;
    }

    const sets = [];
    const vals = [];
    let i = 1;
    for (const k of keys) {
      let v = patch[k];
      if (k === 'name' && v != null) v = String(v).trim();
      if (k === 'code' && v != null) v = String(v).trim() || null;
      if (k === 'capacity' && v != null) v = parseInt(v, 10);
      sets.push(`${k} = $${i++}`);
      vals.push(v);
    }
    sets.push('updated_at = NOW()');

    const idPh = i;
    const churchPh = i + 1;
    vals.push(id, churchId);

    const upd = await client.query(
      `UPDATE branches SET ${sets.join(', ')}
       WHERE id = $${idPh} AND church_id = $${churchPh}
       RETURNING ${LIST_FIELDS}`,
      vals
    );

    await client.query('COMMIT');
    res.json({ success: true, data: upd.rows[0] });
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') {
      return res.status(409).json({ success: false, message: 'Branch code already in use' });
    }
    throw e;
  } finally {
    client.release();
  }
});

// DELETE /api/branches/:id — soft-archive (cannot hard-delete while members reference branch)
exports.archive = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const churchId = req.user.church_id;

  const chk = await query(
    `SELECT id FROM branches WHERE id = $1 AND church_id = $2`,
    [id, churchId]
  );
  if (!chk.rows.length) {
    return res.status(404).json({ success: false, message: 'Branch not found' });
  }

  await query(
    `UPDATE branches SET status = 'archived', updated_at = NOW() WHERE id = $1`,
    [id]
  );

  res.json({ success: true, message: 'Branch archived' });
});
