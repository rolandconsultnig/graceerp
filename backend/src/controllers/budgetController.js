const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

const B_STATUSES = ['draft', 'approved', 'active', 'closed'];
const E_STATUSES = ['pending', 'hod_approved', 'elder_approved', 'approved', 'rejected', 'paid', 'cancelled'];

function canApproveStep(role, status) {
  if (role === 'super_admin' || role === 'branch_admin') return true;
  if (status === 'pending') return role === 'dept_head';
  if (status === 'hod_approved') return role === 'coordinating_elder';
  if (status === 'elder_approved') return role === 'coordinating_pastor';
  return false;
}

exports.listBudgets = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { page = 1, limit = 20, fiscal_year, department, status } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  const offset = (parseInt(page, 10) - 1) * lim;

  const conditions = [`b.church_id = $1`];
  const params = [churchId];
  let pi = 2;

  if (req.branchId) {
    conditions.push(`b.branch_id = $${pi++}`);
    params.push(req.branchId);
  }

  if (fiscal_year) {
    conditions.push(`b.fiscal_year = $${pi++}`);
    params.push(parseInt(fiscal_year, 10));
  }

  if (department) {
    conditions.push(`b.department ILIKE $${pi++}`);
    params.push(`%${department}%`);
  }

  if (status && B_STATUSES.includes(status)) {
    conditions.push(`b.status = $${pi++}`);
    params.push(status);
  }

  const where = conditions.join(' AND ');
  const countRes = await query(`SELECT COUNT(*) FROM budgets b WHERE ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const result = await query(
    `SELECT b.*, br.name AS branch_name
     FROM budgets b JOIN branches br ON b.branch_id = br.id
     WHERE ${where}
     ORDER BY b.fiscal_year DESC, b.created_at DESC
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, lim, offset]
  );

  res.json({
    success: true,
    data: result.rows,
    pagination: { page: parseInt(page, 10), limit: lim, total, pages: Math.ceil(total / lim) || 1 },
  });
});

exports.getBudget = asyncHandler(async (req, res) => {
  const scoped = req.branchId ? ` AND b.branch_id = $3` : '';
  const params = req.branchId ? [req.params.id, req.user.church_id, req.branchId] : [req.params.id, req.user.church_id];

  const result = await query(
    `SELECT b.*, br.name AS branch_name FROM budgets b JOIN branches br ON b.branch_id = br.id
     WHERE b.id = $1 AND b.church_id = $2 ${scoped}`,
    params
  );
  if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: result.rows[0] });
});

exports.createBudget = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const b = req.body;

  if (!b.fiscal_year || !b.department?.trim() || b.total_amount == null) {
    return res.status(400).json({ success: false, message: 'fiscal_year, department, total_amount required' });
  }

  let bid = b.branch_id || req.branchId;
  if (!bid) return res.status(400).json({ success: false, message: 'branch_id required' });
  if (req.branchId && b.branch_id && b.branch_id !== req.branchId) {
    return res.status(403).json({ success: false, message: 'Cannot create budget outside your branch' });
  }

  const chk = await query(`SELECT id FROM branches WHERE id=$1 AND church_id=$2`, [bid, churchId]);
  if (!chk.rows.length) return res.status(400).json({ success: false, message: 'Invalid branch' });

  const st = B_STATUSES.includes(b.status) ? b.status : 'draft';

  const ins = await query(
    `INSERT INTO budgets (church_id, branch_id, fiscal_year, department, total_amount, currency, description, approved_by, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      churchId,
      bid,
      parseInt(b.fiscal_year, 10),
      b.department.trim(),
      b.total_amount,
      b.currency || 'NGN',
      b.description || null,
      b.approved_by || null,
      st,
    ]
  );

  res.status(201).json({ success: true, data: ins.rows[0] });
});

exports.updateBudget = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { id } = req.params;

  const allowed = [
    'branch_id',
    'fiscal_year',
    'department',
    'total_amount',
    'currency',
    'description',
    'approved_by',
    'status',
  ];

  const patch = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, k)) patch[k] = req.body[k];
  }

  if (patch.status != null && !B_STATUSES.includes(patch.status)) delete patch.status;

  if (patch.branch_id) {
    const chk = await query(`SELECT id FROM branches WHERE id=$1 AND church_id=$2`, [patch.branch_id, churchId]);
    if (!chk.rows.length) return res.status(400).json({ success: false, message: 'Invalid branch' });
  }

  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  if (!keys.length) {
    const cur = await query(`SELECT * FROM budgets WHERE id=$1 AND church_id=$2`, [id, churchId]);
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

  const upd = await query(
    `UPDATE budgets SET ${sets.join(', ')} WHERE id=$${idPh} AND church_id=$${churchPh} RETURNING *`,
    vals
  );
  if (!upd.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: upd.rows[0] });
});

exports.deleteBudget = asyncHandler(async (req, res) => {
  const r = await query(`DELETE FROM budgets WHERE id=$1 AND church_id=$2 RETURNING id`, [req.params.id, req.user.church_id]);
  if (!r.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, message: 'Deleted' });
});

exports.listExpenditure = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { page = 1, limit = 25, budget_id, status } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 25, 150);
  const offset = (parseInt(page, 10) - 1) * lim;

  const conditions = [`e.church_id = $1`];
  const params = [churchId];
  let pi = 2;

  if (req.branchId) {
    conditions.push(`e.branch_id = $${pi++}`);
    params.push(req.branchId);
  }

  if (budget_id) {
    conditions.push(`e.budget_id = $${pi++}`);
    params.push(budget_id);
  }

  if (status && E_STATUSES.includes(status)) {
    conditions.push(`e.status = $${pi++}`);
    params.push(status);
  }

  const where = conditions.join(' AND ');
  const countRes = await query(`SELECT COUNT(*) FROM expenditure_requests e WHERE ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const result = await query(
    `SELECT e.*, b.name AS branch_name, bd.department AS budget_department,
            uh.full_name AS hod_approver_name,
            ue.full_name AS elder_approver_name,
            up.full_name AS pastor_approver_name
     FROM expenditure_requests e
     JOIN branches b ON e.branch_id = b.id
     LEFT JOIN budgets bd ON e.budget_id = bd.id
     LEFT JOIN users uh ON e.hod_approved_by = uh.id
     LEFT JOIN users ue ON e.elder_approved_by = ue.id
     LEFT JOIN users up ON e.pastor_approved_by = up.id
     WHERE ${where}
     ORDER BY e.created_at DESC
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, lim, offset]
  );

  res.json({
    success: true,
    data: result.rows,
    pagination: { page: parseInt(page, 10), limit: lim, total, pages: Math.ceil(total / lim) || 1 },
  });
});

exports.getExpenditure = asyncHandler(async (req, res) => {
  const scoped = req.branchId ? ` AND e.branch_id = $3` : '';
  const params = req.branchId ? [req.params.eid, req.user.church_id, req.branchId] : [req.params.eid, req.user.church_id];

  const result = await query(
    `SELECT e.*, b.name AS branch_name,
            uh.full_name AS hod_approver_name,
            ue.full_name AS elder_approver_name,
            up.full_name AS pastor_approver_name
     FROM expenditure_requests e
     JOIN branches b ON e.branch_id = b.id
     LEFT JOIN users uh ON e.hod_approved_by = uh.id
     LEFT JOIN users ue ON e.elder_approved_by = ue.id
     LEFT JOIN users up ON e.pastor_approved_by = up.id
     WHERE e.id = $1 AND e.church_id = $2 ${scoped}`,
    params
  );
  if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: result.rows[0] });
});

exports.createExpenditure = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const x = req.body;

  if (!x.title?.trim() || x.amount == null) {
    return res.status(400).json({ success: false, message: 'title and amount required' });
  }

  let bid = x.branch_id || req.branchId;
  if (!bid) return res.status(400).json({ success: false, message: 'branch_id required' });

  const chk = await query(`SELECT id FROM branches WHERE id=$1 AND church_id=$2`, [bid, churchId]);
  if (!chk.rows.length) return res.status(400).json({ success: false, message: 'Invalid branch' });

  if (x.budget_id) {
    const bc = await query(`SELECT id FROM budgets WHERE id=$1 AND church_id=$2`, [x.budget_id, churchId]);
    if (!bc.rows.length) return res.status(400).json({ success: false, message: 'Invalid budget_id' });
  }

  /* New requests always start at step 1 (department head). Approvals use POST …/approve. */
  const ins = await query(
    `INSERT INTO expenditure_requests (
      church_id, branch_id, budget_id, title, description, amount, currency, department,
      requested_by, approved_by, status, rejection_reason, payment_date, payment_method
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [
      churchId,
      bid,
      x.budget_id || null,
      x.title.trim(),
      x.description || null,
      x.amount,
      x.currency || 'NGN',
      x.department?.trim() || null,
      req.user.id,
      null,
      'pending',
      null,
      null,
      null,
    ]
  );

  res.status(201).json({ success: true, data: ins.rows[0] });
});

exports.updateExpenditure = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { eid } = req.params;
  const role = req.user.role;

  const cur = await query(`SELECT * FROM expenditure_requests WHERE id=$1 AND church_id=$2`, [eid, churchId]);
  if (!cur.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  const row = cur.rows[0];

  if (req.branchId && row.branch_id !== req.branchId) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const openStatuses = ['pending', 'hod_approved', 'elder_approved'];
  const manageBudget = ['super_admin', 'branch_admin', 'finance_officer'].includes(role);

  const patch = {};
  const body = req.body;

  if (openStatuses.includes(row.status) && manageBudget) {
    for (const k of ['budget_id', 'title', 'description', 'amount', 'currency', 'department']) {
      if (Object.prototype.hasOwnProperty.call(body, k)) patch[k] = body[k];
    }
  }

  const financeRoles = ['finance_officer', 'super_admin', 'branch_admin'];
  if (row.status === 'approved' && financeRoles.includes(role)) {
    if (Object.prototype.hasOwnProperty.call(body, 'payment_date')) patch.payment_date = body.payment_date;
    if (Object.prototype.hasOwnProperty.call(body, 'payment_method')) patch.payment_method = body.payment_method;
    if (body.status === 'paid') patch.status = 'paid';
  }

  if (financeRoles.includes(role) && body.status === 'cancelled' && !['paid', 'cancelled'].includes(row.status)) {
    patch.status = 'cancelled';
  }

  if (patch.budget_id) {
    const bc = await query(`SELECT id FROM budgets WHERE id=$1 AND church_id=$2`, [patch.budget_id, churchId]);
    if (!bc.rows.length) return res.status(400).json({ success: false, message: 'Invalid budget_id' });
  }

  if (patch.status != null && !E_STATUSES.includes(patch.status)) delete patch.status;

  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  if (!keys.length) {
    return res.json({ success: true, data: row });
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
  vals.push(eid, churchId);

  const upd = await query(
    `UPDATE expenditure_requests SET ${sets.join(', ')} WHERE id=$${idPh} AND church_id=$${churchPh} RETURNING *`,
    vals
  );
  if (!upd.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: upd.rows[0] });
});

exports.approveExpenditure = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { eid } = req.params;

  const result = await query(`SELECT * FROM expenditure_requests WHERE id = $1 AND church_id = $2`, [eid, churchId]);
  if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  const exp = result.rows[0];

  if (req.branchId && exp.branch_id !== req.branchId) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const role = req.user.role;
  if (!canApproveStep(role, exp.status)) {
    return res.status(403).json({
      success: false,
      message: 'Your role cannot approve at this stage (1: dept head → 2: coordinating elder → 3: coordinating pastor).',
    });
  }

  const uid = req.user.id;
  let upd;

  if (exp.status === 'pending') {
    upd = await query(
      `UPDATE expenditure_requests
       SET status = 'hod_approved', hod_approved_at = NOW(), hod_approved_by = $1, updated_at = NOW()
       WHERE id = $2 AND church_id = $3 RETURNING *`,
      [uid, eid, churchId]
    );
  } else if (exp.status === 'hod_approved') {
    upd = await query(
      `UPDATE expenditure_requests
       SET status = 'elder_approved', elder_approved_at = NOW(), elder_approved_by = $1, updated_at = NOW()
       WHERE id = $2 AND church_id = $3 RETURNING *`,
      [uid, eid, churchId]
    );
  } else if (exp.status === 'elder_approved') {
    upd = await query(
      `UPDATE expenditure_requests
       SET status = 'approved', pastor_approved_at = NOW(), pastor_approved_by = $1, updated_at = NOW()
       WHERE id = $2 AND church_id = $3 RETURNING *`,
      [uid, eid, churchId]
    );
  } else {
    return res.status(400).json({
      success: false,
      message: 'This request is not waiting for an approval step (or is already finalised).',
    });
  }

  res.json({ success: true, data: upd.rows[0] });
});

exports.rejectExpenditure = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { eid } = req.params;
  const reason = (req.body.reason || '').trim();

  if (!reason) {
    return res.status(400).json({ success: false, message: 'Rejection reason is required' });
  }

  const rejectRoles = [
    'super_admin',
    'branch_admin',
    'finance_officer',
    'dept_head',
    'coordinating_elder',
    'coordinating_pastor',
  ];
  if (!rejectRoles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const result = await query(`SELECT * FROM expenditure_requests WHERE id = $1 AND church_id = $2`, [eid, churchId]);
  if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  const exp = result.rows[0];

  if (req.branchId && exp.branch_id !== req.branchId) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  if (['paid', 'rejected', 'cancelled'].includes(exp.status)) {
    return res.status(400).json({ success: false, message: 'Cannot reject this request in its current state' });
  }

  const upd = await query(
    `UPDATE expenditure_requests
     SET status = 'rejected', rejection_reason = $1, updated_at = NOW()
     WHERE id = $2 AND church_id = $3 RETURNING *`,
    [reason, eid, churchId]
  );

  res.json({ success: true, data: upd.rows[0] });
});

exports.deleteExpenditure = asyncHandler(async (req, res) => {
  const r = await query(`DELETE FROM expenditure_requests WHERE id=$1 AND church_id=$2 RETURNING id`, [
    req.params.eid,
    req.user.church_id,
  ]);
  if (!r.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, message: 'Deleted' });
});
