const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

const ALLOWED_ROLES = [
  'super_admin',
  'branch_admin',
  'finance_officer',
  'pastor',
  'content_manager',
  'hr_officer',
  'dept_head',
  'coordinating_elder',
  'coordinating_pastor',
  'member',
];

async function countActiveSuperAdmins(churchId, excludeUserId = null) {
  const params = [churchId];
  let sql = `SELECT COUNT(*)::int AS c FROM users
             WHERE church_id = $1 AND role = 'super_admin' AND is_active = TRUE`;
  if (excludeUserId) {
    sql += ` AND id <> $2`;
    params.push(excludeUserId);
  }
  const r = await query(sql, params);
  return r.rows[0].c;
}

// GET /api/users
exports.list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, role: roleFilter, is_active } = req.query;
  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const churchId = req.user.church_id;

  const conditions = ['u.church_id = $1'];
  const params = [churchId];
  let pi = 2;

  if (req.branchId) {
    conditions.push(`u.branch_id = $${pi++}`);
    params.push(req.branchId);
  }

  if (roleFilter) {
    conditions.push(`u.role = $${pi++}`);
    params.push(roleFilter);
  }

  if (is_active !== undefined && is_active !== '') {
    conditions.push(`u.is_active = $${pi++}`);
    params.push(String(is_active) === 'true');
  }

  if (search) {
    conditions.push(`(u.email ILIKE $${pi} OR u.full_name ILIKE $${pi})`);
    params.push(`%${search}%`);
    pi++;
  }

  const where = conditions.join(' AND ');
  const lim = parseInt(limit, 10);
  const off = offset;

  const countRes = await query(`SELECT COUNT(*) FROM users u WHERE ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const result = await query(
    `SELECT u.id, u.email, u.full_name, u.role, u.branch_id, u.is_active, u.last_login, u.created_at,
            b.name AS branch_name
     FROM users u
     LEFT JOIN branches b ON u.branch_id = b.id
     WHERE ${where}
     ORDER BY u.created_at DESC
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, lim, off]
  );

  res.json({
    success: true,
    data: result.rows,
    pagination: {
      page: parseInt(page, 10),
      limit: lim,
      total,
      pages: Math.ceil(total / lim) || 1,
    },
  });
});

// GET /api/users/:id
exports.getOne = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT u.id, u.email, u.full_name, u.role, u.branch_id, u.is_active, u.last_login, u.created_at,
            b.name AS branch_name
     FROM users u
     LEFT JOIN branches b ON u.branch_id = b.id
     WHERE u.id = $1 AND u.church_id = $2`,
    [req.params.id, req.user.church_id]
  );
  if (!result.rows.length) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  const row = result.rows[0];

  if (req.user.role === 'branch_admin') {
    if (row.branch_id !== req.user.branch_id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
  }

  res.json({ success: true, data: row });
});

// POST /api/users — invite staff (super admin)
exports.create = asyncHandler(async (req, res) => {
  let { email, full_name, role, branch_id, password } = req.body;

  if (!email || !String(email).trim()) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }
  if (!full_name || !String(full_name).trim()) {
    return res.status(400).json({ success: false, message: 'Full name is required' });
  }
  if (!role || !ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ success: false, message: 'Valid role is required' });
  }

  email = email.toLowerCase().trim();

  if (password != null && String(password).length > 0 && String(password).length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters, or omit to auto-generate one',
    });
  }

  const generated = !password || String(password).length === 0;
  const plainPassword = generated
    ? crypto.randomBytes(12).toString('base64url').slice(0, 14)
    : String(password);

  const password_hash = await bcrypt.hash(plainPassword, 10);
  const churchId = req.user.church_id;

  if (branch_id) {
    const b = await query(`SELECT id FROM branches WHERE id = $1 AND church_id = $2`, [branch_id, churchId]);
    if (!b.rows.length) {
      return res.status(400).json({ success: false, message: 'Invalid branch for this congregation' });
    }
  }

  try {
    const ins = await query(
      `INSERT INTO users (church_id, branch_id, email, password_hash, full_name, role)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, email, full_name, role, branch_id, is_active, created_at`,
      [churchId, branch_id || null, email, password_hash, full_name.trim(), role]
    );

    res.status(201).json({
      success: true,
      data: ins.rows[0],
      ...(generated ? { temporaryPassword: plainPassword } : {}),
    });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }
    throw e;
  }
});

// PUT /api/users/:id
exports.update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const churchId = req.user.church_id;

  const cur = await query(
    `SELECT id, role, is_active FROM users WHERE id = $1 AND church_id = $2`,
    [id, churchId]
  );
  if (!cur.rows.length) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const existing = cur.rows[0];

  if (id === req.user.id && req.body.is_active === false) {
    return res.status(400).json({ success: false, message: 'You cannot deactivate your own account here.' });
  }

  const { full_name, role, branch_id, is_active, password } = req.body;
  const patch = {};

  if (full_name !== undefined) patch.full_name = String(full_name).trim();
  if (role !== undefined) {
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }
    patch.role = role;
  }
  if (branch_id !== undefined) {
    if (branch_id === null || branch_id === '') {
      patch.branch_id = null;
    } else {
      const b = await query(`SELECT id FROM branches WHERE id = $1 AND church_id = $2`, [branch_id, churchId]);
      if (!b.rows.length) {
        return res.status(400).json({ success: false, message: 'Invalid branch' });
      }
      patch.branch_id = branch_id;
    }
  }
  if (is_active !== undefined) patch.is_active = !!is_active;

  let newPasswordHash;
  if (password != null && String(password).length > 0) {
    if (String(password).length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    newPasswordHash = await bcrypt.hash(String(password), 10);
  }

  const demotingSuper =
    existing.role === 'super_admin' &&
    patch.role &&
    patch.role !== 'super_admin';

  const deactivatingSuper =
    existing.role === 'super_admin' &&
    patch.is_active === false;

  if (demotingSuper || deactivatingSuper) {
    const otherSupers = await countActiveSuperAdmins(churchId, id);
    if (otherSupers < 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove or deactivate the last active super administrator.',
      });
    }
  }

  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  if (keys.length === 0 && !newPasswordHash) {
    const fresh = await query(
      `SELECT u.id, u.email, u.full_name, u.role, u.branch_id, u.is_active, u.last_login, u.created_at,
              b.name AS branch_name
       FROM users u
       LEFT JOIN branches b ON u.branch_id = b.id
       WHERE u.id = $1 AND u.church_id = $2`,
      [id, churchId]
    );
    return res.json({ success: true, data: fresh.rows[0] });
  }

  const sets = [];
  const vals = [];
  let i = 1;

  for (const k of keys) {
    sets.push(`${k} = $${i++}`);
    vals.push(patch[k]);
  }

  if (newPasswordHash) {
    sets.push(`password_hash = $${i++}`);
    vals.push(newPasswordHash);
    sets.push('refresh_token = NULL');
  }

  sets.push('updated_at = NOW()');

  const idPh = i;
  const churchPh = i + 1;
  vals.push(id, churchId);

  await query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${idPh} AND church_id = $${churchPh}`, vals);

  const fresh = await query(
    `SELECT u.id, u.email, u.full_name, u.role, u.branch_id, u.is_active, u.last_login, u.created_at,
            b.name AS branch_name
     FROM users u
     LEFT JOIN branches b ON u.branch_id = b.id
     WHERE u.id = $1 AND u.church_id = $2`,
    [id, churchId]
  );

  res.json({ success: true, data: fresh.rows[0] });
});

// DELETE /api/users/:id — deactivate (soft)
exports.deactivate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const churchId = req.user.church_id;

  if (id === req.user.id) {
    return res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
  }

  const cur = await query(
    `SELECT id, role, is_active FROM users WHERE id = $1 AND church_id = $2`,
    [id, churchId]
  );
  if (!cur.rows.length) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const existing = cur.rows[0];

  if (existing.role === 'super_admin' && existing.is_active) {
    const others = await countActiveSuperAdmins(churchId, id);
    if (others < 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate the last active super administrator.',
      });
    }
  }

  await query(
    `UPDATE users SET is_active = FALSE, refresh_token = NULL, updated_at = NOW()
     WHERE id = $1 AND church_id = $2`,
    [id, churchId]
  );

  res.json({ success: true, message: 'User deactivated' });
});
