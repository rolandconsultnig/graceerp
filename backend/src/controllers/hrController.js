const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

const EMP_TYPES = ['full_time', 'part_time', 'contract', 'volunteer'];
const LEAVE_TYPES = ['annual', 'sick', 'compassionate', 'maternity', 'paternity', 'unpaid'];
const LEAVE_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];

exports.listStaff = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { page = 1, limit = 20, search, department, is_active } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  const offset = (parseInt(page, 10) - 1) * lim;

  const conditions = [`s.church_id = $1`];
  const params = [churchId];
  let pi = 2;

  if (req.branchId) {
    conditions.push(`s.branch_id = $${pi++}`);
    params.push(req.branchId);
  }

  if (is_active !== undefined && is_active !== '') {
    conditions.push(`s.is_active = $${pi++}`);
    params.push(String(is_active) === 'true');
  }

  if (department) {
    conditions.push(`s.department ILIKE $${pi++}`);
    params.push(`%${department}%`);
  }

  if (search) {
    conditions.push(`(s.full_name ILIKE $${pi} OR s.email ILIKE $${pi} OR s.employee_number ILIKE $${pi})`);
    params.push(`%${search}%`);
    pi++;
  }

  const where = conditions.join(' AND ');
  const countRes = await query(`SELECT COUNT(*) FROM staff s WHERE ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const result = await query(
    `SELECT s.*, b.name AS branch_name
     FROM staff s JOIN branches b ON s.branch_id = b.id
     WHERE ${where}
     ORDER BY s.created_at DESC
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, lim, offset]
  );

  res.json({
    success: true,
    data: result.rows,
    pagination: { page: parseInt(page, 10), limit: lim, total, pages: Math.ceil(total / lim) || 1 },
  });
});

exports.getStaff = asyncHandler(async (req, res) => {
  const scoped = req.branchId ? ` AND s.branch_id = $3` : '';
  const params = req.branchId ? [req.params.id, req.user.church_id, req.branchId] : [req.params.id, req.user.church_id];

  const result = await query(
    `SELECT s.*, b.name AS branch_name FROM staff s JOIN branches b ON s.branch_id = b.id
     WHERE s.id = $1 AND s.church_id = $2 ${scoped}`,
    params
  );
  if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: result.rows[0] });
});

exports.createStaff = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const b = req.body;

  if (!b.full_name?.trim()) return res.status(400).json({ success: false, message: 'full_name required' });

  let bid = b.branch_id || req.branchId;
  if (!bid) return res.status(400).json({ success: false, message: 'branch_id required' });

  const chk = await query(`SELECT id FROM branches WHERE id=$1 AND church_id=$2`, [bid, churchId]);
  if (!chk.rows.length) return res.status(400).json({ success: false, message: 'Invalid branch' });

  const et = EMP_TYPES.includes(b.employment_type) ? b.employment_type : 'full_time';

  try {
    const ins = await query(
      `INSERT INTO staff (
        church_id, branch_id, member_id, employee_number, full_name, email, phone,
        role_title, department, employment_type, start_date, end_date, monthly_salary,
        currency, bank_name, account_number, manager_id, leave_balance, is_active
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      RETURNING *`,
      [
        churchId,
        bid,
        b.member_id || null,
        b.employee_number?.trim() || null,
        b.full_name.trim(),
        b.email?.trim()?.toLowerCase() || null,
        b.phone?.trim() || null,
        b.role_title?.trim() || null,
        b.department?.trim() || null,
        et,
        b.start_date || null,
        b.end_date || null,
        b.monthly_salary ?? null,
        b.currency || 'NGN',
        b.bank_name?.trim() || null,
        b.account_number?.trim() || null,
        b.manager_id || null,
        b.leave_balance != null ? parseInt(b.leave_balance, 10) : 20,
        b.is_active !== false,
      ]
    );
    res.status(201).json({ success: true, data: ins.rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ success: false, message: 'Employee number already exists' });
    throw e;
  }
});

exports.updateStaff = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { id } = req.params;

  const allowed = [
    'branch_id',
    'member_id',
    'employee_number',
    'full_name',
    'email',
    'phone',
    'role_title',
    'department',
    'employment_type',
    'start_date',
    'end_date',
    'monthly_salary',
    'currency',
    'bank_name',
    'account_number',
    'manager_id',
    'leave_balance',
    'is_active',
  ];

  const patch = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, k)) patch[k] = req.body[k];
  }

  if (patch.employment_type != null && !EMP_TYPES.includes(patch.employment_type)) delete patch.employment_type;

  if (patch.branch_id) {
    const chk = await query(`SELECT id FROM branches WHERE id=$1 AND church_id=$2`, [patch.branch_id, churchId]);
    if (!chk.rows.length) return res.status(400).json({ success: false, message: 'Invalid branch' });
  }

  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  if (!keys.length) {
    const cur = await query(`SELECT * FROM staff WHERE id=$1 AND church_id=$2`, [id, churchId]);
    if (!cur.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, data: cur.rows[0] });
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
      `UPDATE staff SET ${sets.join(', ')} WHERE id=$${idPh} AND church_id=$${churchPh} RETURNING *`,
      vals
    );
    if (!upd.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: upd.rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ success: false, message: 'Employee number conflict' });
    throw e;
  }
});

exports.deleteStaff = asyncHandler(async (req, res) => {
  const r = await query(`DELETE FROM staff WHERE id=$1 AND church_id=$2 RETURNING id`, [req.params.id, req.user.church_id]);
  if (!r.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, message: 'Deleted' });
});

exports.listLeaveRequests = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { page = 1, limit = 25, staff_id, status } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 25, 150);
  const offset = (parseInt(page, 10) - 1) * lim;

  const conditions = [`s.church_id = $1`];
  const params = [churchId];
  let pi = 2;

  if (req.branchId) {
    conditions.push(`s.branch_id = $${pi++}`);
    params.push(req.branchId);
  }

  if (staff_id) {
    conditions.push(`lr.staff_id = $${pi++}`);
    params.push(staff_id);
  }

  if (status && LEAVE_STATUSES.includes(status)) {
    conditions.push(`lr.status = $${pi++}`);
    params.push(status);
  }

  const where = conditions.join(' AND ');
  const countRes = await query(
    `SELECT COUNT(*) FROM leave_requests lr JOIN staff s ON lr.staff_id = s.id WHERE ${where}`,
    params
  );
  const total = parseInt(countRes.rows[0].count, 10);

  const result = await query(
    `SELECT lr.*, s.full_name AS staff_name, s.employee_number, b.name AS branch_name
     FROM leave_requests lr
     JOIN staff s ON lr.staff_id = s.id
     JOIN branches b ON s.branch_id = b.id
     WHERE ${where}
     ORDER BY lr.created_at DESC
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, lim, offset]
  );

  res.json({
    success: true,
    data: result.rows,
    pagination: { page: parseInt(page, 10), limit: lim, total, pages: Math.ceil(total / lim) || 1 },
  });
});

exports.createLeaveRequest = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { staff_id, leave_type, start_date, end_date, days_requested, reason } = req.body;

  if (!staff_id || !start_date || !end_date) {
    return res.status(400).json({ success: false, message: 'staff_id, start_date, end_date required' });
  }

  const stf = await query(`SELECT id, branch_id FROM staff WHERE id=$1 AND church_id=$2`, [staff_id, churchId]);
  if (!stf.rows.length) return res.status(404).json({ success: false, message: 'Staff not found' });
  if (req.branchId && stf.rows[0].branch_id !== req.branchId) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const lt = LEAVE_TYPES.includes(leave_type) ? leave_type : 'annual';

  const ins = await query(
    `INSERT INTO leave_requests (staff_id, leave_type, start_date, end_date, days_requested, reason)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [
      staff_id,
      lt,
      start_date,
      end_date,
      days_requested != null ? parseInt(days_requested, 10) : null,
      reason || null,
    ]
  );

  res.status(201).json({ success: true, data: ins.rows[0] });
});

exports.updateLeaveRequest = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { id } = req.params;

  const chk = await query(
    `SELECT lr.id FROM leave_requests lr JOIN staff s ON lr.staff_id = s.id WHERE lr.id=$1 AND s.church_id=$2`,
    [id, churchId]
  );
  if (!chk.rows.length) return res.status(404).json({ success: false, message: 'Not found' });

  const allowed = ['leave_type', 'start_date', 'end_date', 'days_requested', 'reason', 'status', 'approved_by'];
  const patch = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, k)) patch[k] = req.body[k];
  }

  if (patch.leave_type != null && !LEAVE_TYPES.includes(patch.leave_type)) delete patch.leave_type;
  if (patch.status != null && !LEAVE_STATUSES.includes(patch.status)) delete patch.status;

  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  if (!keys.length) {
    const cur = await query(`SELECT * FROM leave_requests WHERE id=$1`, [id]);
    return res.json({ success: true, data: cur.rows[0] });
  }

  const sets = [];
  const vals = [];
  let i = 1;
  for (const k of keys) {
    sets.push(`${k} = $${i++}`);
    vals.push(patch[k]);
  }
  sets.push('updated_at = NOW()');
  vals.push(id);

  await query(`UPDATE leave_requests SET ${sets.join(', ')} WHERE id=$${i}`, vals);

  const fresh = await query(`SELECT * FROM leave_requests WHERE id=$1`, [id]);
  res.json({ success: true, data: fresh.rows[0] });
});
