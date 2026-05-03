const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

const P_STATUSES = ['planning', 'active', 'on_hold', 'completed', 'cancelled'];
const PRIORITIES = ['low', 'medium', 'high'];
const DBS_STATUSES = ['draft', 'pending', 'hod_approved', 'elder_approved', 'approved', 'rejected'];

function canApproveStep(role, status) {
  if (role === 'super_admin' || role === 'branch_admin') return true;
  if (status === 'pending') return role === 'dept_head';
  if (status === 'hod_approved') return role === 'coordinating_elder';
  if (status === 'elder_approved') return role === 'coordinating_pastor';
  return false;
}

function canApproveDeptBudget(role, status) {
  if (!['pending', 'hod_approved', 'elder_approved'].includes(status)) return false;
  return canApproveStep(role, status);
}

const manageRoles = ['super_admin', 'branch_admin', 'finance_officer'];

function isManage(role) {
  return manageRoles.includes(role);
}

exports.listProjects = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { page = 1, limit = 20, status, department, search } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  const offset = (parseInt(page, 10) - 1) * lim;

  const conditions = [`p.church_id = $1`];
  const params = [churchId];
  let pi = 2;

  if (req.branchId) {
    conditions.push(`p.branch_id = $${pi++}`);
    params.push(req.branchId);
  }

  if (status && P_STATUSES.includes(status)) {
    conditions.push(`p.status = $${pi++}`);
    params.push(status);
  }

  if (department) {
    conditions.push(`p.department ILIKE $${pi++}`);
    params.push(`%${department}%`);
  }

  if (search) {
    conditions.push(`(p.name ILIKE $${pi} OR p.code ILIKE $${pi})`);
    params.push(`%${search}%`);
    pi += 1;
  }

  const where = conditions.join(' AND ');
  const countRes = await query(`SELECT COUNT(*) FROM projects p WHERE ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const result = await query(
    `SELECT p.*, br.name AS branch_name,
            u.full_name AS owner_name
     FROM projects p
     JOIN branches br ON p.branch_id = br.id
     LEFT JOIN users u ON p.owner_user_id = u.id
     WHERE ${where}
     ORDER BY p.updated_at DESC
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, lim, offset]
  );

  res.json({
    success: true,
    data: result.rows,
    pagination: { page: parseInt(page, 10), limit: lim, total, pages: Math.ceil(total / lim) || 1 },
  });
});

exports.getProject = asyncHandler(async (req, res) => {
  const scoped = req.branchId ? ` AND p.branch_id = $3` : '';
  const params = req.branchId ? [req.params.id, req.user.church_id, req.branchId] : [req.params.id, req.user.church_id];

  const result = await query(
    `SELECT p.*, br.name AS branch_name, u.full_name AS owner_name
     FROM projects p
     JOIN branches br ON p.branch_id = br.id
     LEFT JOIN users u ON p.owner_user_id = u.id
     WHERE p.id = $1 AND p.church_id = $2 ${scoped}`,
    params
  );
  if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: result.rows[0] });
});

exports.createProject = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const b = req.body;

  if (!b.name?.trim()) {
    return res.status(400).json({ success: false, message: 'name required' });
  }

  let bid = b.branch_id || req.branchId;
  if (!bid) return res.status(400).json({ success: false, message: 'branch_id required' });

  const chk = await query(`SELECT id FROM branches WHERE id=$1 AND church_id=$2`, [bid, churchId]);
  if (!chk.rows.length) return res.status(400).json({ success: false, message: 'Invalid branch' });

  let ownerId = b.owner_user_id || null;
  if (ownerId) {
    const ou = await query(`SELECT id FROM users WHERE id=$1 AND church_id=$2`, [ownerId, churchId]);
    if (!ou.rows.length) ownerId = null;
  }

  const st = P_STATUSES.includes(b.status) ? b.status : 'planning';
  const pr = PRIORITIES.includes(b.priority) ? b.priority : 'medium';

  const ins = await query(
    `INSERT INTO projects (
      church_id, branch_id, code, name, description, department, status, priority,
      start_date, end_date, budget_amount, spent_amount, currency, owner_user_id, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [
      churchId,
      bid,
      b.code?.trim() || null,
      b.name.trim(),
      b.description || null,
      b.department?.trim() || null,
      st,
      pr,
      b.start_date || null,
      b.end_date || null,
      b.budget_amount != null ? b.budget_amount : null,
      b.spent_amount != null ? b.spent_amount : 0,
      b.currency || 'NGN',
      ownerId,
      req.user.id,
    ]
  );

  res.status(201).json({ success: true, data: ins.rows[0] });
});

exports.updateProject = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { id } = req.params;

  const cur = await query(`SELECT * FROM projects WHERE id=$1 AND church_id=$2`, [id, churchId]);
  if (!cur.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  const row = cur.rows[0];

  if (req.branchId && row.branch_id !== req.branchId) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const allowed = [
    'branch_id',
    'code',
    'name',
    'description',
    'department',
    'status',
    'priority',
    'start_date',
    'end_date',
    'budget_amount',
    'spent_amount',
    'currency',
    'owner_user_id',
  ];

  const patch = {};
  const body = req.body;
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, k)) patch[k] = body[k];
  }

  if (patch.branch_id) {
    const chk = await query(`SELECT id FROM branches WHERE id=$1 AND church_id=$2`, [patch.branch_id, churchId]);
    if (!chk.rows.length) return res.status(400).json({ success: false, message: 'Invalid branch_id' });
  }

  if (patch.owner_user_id) {
    const ou = await query(`SELECT id FROM users WHERE id=$1 AND church_id=$2`, [patch.owner_user_id, churchId]);
    if (!ou.rows.length) delete patch.owner_user_id;
  }

  if (patch.status != null && !P_STATUSES.includes(patch.status)) delete patch.status;
  if (patch.priority != null && !PRIORITIES.includes(patch.priority)) delete patch.priority;

  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  if (!keys.length) return res.json({ success: true, data: row });

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
    `UPDATE projects SET ${sets.join(', ')} WHERE id=$${idPh} AND church_id=$${churchPh} RETURNING *`,
    vals
  );
  res.json({ success: true, data: upd.rows[0] });
});

exports.deleteProject = asyncHandler(async (req, res) => {
  const r = await query(`DELETE FROM projects WHERE id=$1 AND church_id=$2 RETURNING id`, [req.params.id, req.user.church_id]);
  if (!r.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, message: 'Deleted' });
});

/* ── Department budget submissions ─────────────────────────────────────────── */

exports.listDeptBudgets = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { page = 1, limit = 20, fiscal_year, department, status } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  const offset = (parseInt(page, 10) - 1) * lim;

  const conditions = [`d.church_id = $1`];
  const params = [churchId];
  let pi = 2;

  if (req.branchId) {
    conditions.push(`d.branch_id = $${pi++}`);
    params.push(req.branchId);
  }

  if (fiscal_year) {
    conditions.push(`d.fiscal_year = $${pi++}`);
    params.push(parseInt(fiscal_year, 10));
  }

  if (department) {
    conditions.push(`d.department ILIKE $${pi++}`);
    params.push(`%${department}%`);
  }

  if (status && DBS_STATUSES.includes(status)) {
    conditions.push(`d.status = $${pi++}`);
    params.push(status);
  }

  const where = conditions.join(' AND ');
  const countRes = await query(`SELECT COUNT(*) FROM department_budget_submissions d WHERE ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const result = await query(
    `SELECT d.*, br.name AS branch_name,
            pr.name AS project_name,
            uh.full_name AS hod_approver_name,
            ue.full_name AS elder_approver_name,
            up.full_name AS pastor_approver_name,
            sb.full_name AS submitted_by_name
     FROM department_budget_submissions d
     JOIN branches br ON d.branch_id = br.id
     LEFT JOIN projects pr ON d.project_id = pr.id
     LEFT JOIN users uh ON d.hod_approved_by = uh.id
     LEFT JOIN users ue ON d.elder_approved_by = ue.id
     LEFT JOIN users up ON d.pastor_approved_by = up.id
     LEFT JOIN users sb ON d.submitted_by = sb.id
     WHERE ${where}
     ORDER BY d.fiscal_year DESC, d.created_at DESC
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, lim, offset]
  );

  res.json({
    success: true,
    data: result.rows,
    pagination: { page: parseInt(page, 10), limit: lim, total, pages: Math.ceil(total / lim) || 1 },
  });
});

exports.getDeptBudget = asyncHandler(async (req, res) => {
  const scoped = req.branchId ? ` AND d.branch_id = $3` : '';
  const params = req.branchId ? [req.params.bid, req.user.church_id, req.branchId] : [req.params.bid, req.user.church_id];

  const result = await query(
    `SELECT d.*, br.name AS branch_name,
            pr.name AS project_name,
            uh.full_name AS hod_approver_name,
            ue.full_name AS elder_approver_name,
            up.full_name AS pastor_approver_name,
            sb.full_name AS submitted_by_name
     FROM department_budget_submissions d
     JOIN branches br ON d.branch_id = br.id
     LEFT JOIN projects pr ON d.project_id = pr.id
     LEFT JOIN users uh ON d.hod_approved_by = uh.id
     LEFT JOIN users ue ON d.elder_approved_by = ue.id
     LEFT JOIN users up ON d.pastor_approved_by = up.id
     LEFT JOIN users sb ON d.submitted_by = sb.id
     WHERE d.id = $1 AND d.church_id = $2 ${scoped}`,
    params
  );
  if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: result.rows[0] });
});

exports.createDeptBudget = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const x = req.body;

  if (!x.fiscal_year || !x.department?.trim() || !x.title?.trim() || x.requested_amount == null) {
    return res.status(400).json({
      success: false,
      message: 'fiscal_year, department, title, requested_amount required',
    });
  }

  let bid = x.branch_id || req.branchId;
  if (!bid) return res.status(400).json({ success: false, message: 'branch_id required' });

  const chk = await query(`SELECT id FROM branches WHERE id=$1 AND church_id=$2`, [bid, churchId]);
  if (!chk.rows.length) return res.status(400).json({ success: false, message: 'Invalid branch' });

  let projectId = x.project_id || null;
  if (projectId) {
    const pc = await query(`SELECT id FROM projects WHERE id=$1 AND church_id=$2`, [projectId, churchId]);
    if (!pc.rows.length) projectId = null;
  }

  const initialStatus = x.status === 'pending' ? 'pending' : 'draft';
  if (!DBS_STATUSES.includes(initialStatus)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  const ins = await query(
    `INSERT INTO department_budget_submissions (
      church_id, branch_id, project_id, fiscal_year, department, title, narrative,
      requested_amount, currency, submitted_by, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      churchId,
      bid,
      projectId,
      parseInt(x.fiscal_year, 10),
      x.department.trim(),
      x.title.trim(),
      x.narrative || null,
      x.requested_amount,
      x.currency || 'NGN',
      req.user.id,
      initialStatus,
    ]
  );

  res.status(201).json({ success: true, data: ins.rows[0] });
});

exports.submitDeptBudget = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { bid } = req.params;

  const cur = await query(`SELECT * FROM department_budget_submissions WHERE id=$1 AND church_id=$2`, [bid, churchId]);
  if (!cur.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  const row = cur.rows[0];

  if (req.branchId && row.branch_id !== req.branchId) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  if (row.status !== 'draft') {
    return res.status(400).json({ success: false, message: 'Only draft submissions can be submitted' });
  }

  const canSubmit =
    isManage(req.user.role) ||
    row.submitted_by === req.user.id ||
    ['dept_head', 'pastor', 'coordinating_elder', 'coordinating_pastor'].includes(req.user.role);

  if (!canSubmit) {
    return res.status(403).json({ success: false, message: 'You cannot submit this draft' });
  }

  const upd = await query(
    `UPDATE department_budget_submissions
     SET status = 'pending', updated_at = NOW()
     WHERE id = $1 AND church_id = $2 RETURNING *`,
    [bid, churchId]
  );

  res.json({ success: true, data: upd.rows[0] });
});

exports.updateDeptBudget = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { bid } = req.params;
  const role = req.user.role;

  const cur = await query(`SELECT * FROM department_budget_submissions WHERE id=$1 AND church_id=$2`, [bid, churchId]);
  if (!cur.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  const row = cur.rows[0];

  if (req.branchId && row.branch_id !== req.branchId) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const body = req.body;
  const patch = {};
  const pipelineOpen = ['pending', 'hod_approved', 'elder_approved'].includes(row.status);

  if (row.status === 'draft') {
    for (const k of [
      'branch_id',
      'project_id',
      'fiscal_year',
      'department',
      'title',
      'narrative',
      'requested_amount',
      'currency',
    ]) {
      if (Object.prototype.hasOwnProperty.call(body, k)) patch[k] = body[k];
    }
    const authorOk = row.submitted_by === req.user.id || isManage(role);
    if (!authorOk && !['dept_head', 'pastor'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
  } else if (pipelineOpen && isManage(role)) {
    for (const k of ['project_id', 'fiscal_year', 'department', 'title', 'narrative', 'requested_amount', 'currency']) {
      if (Object.prototype.hasOwnProperty.call(body, k)) patch[k] = body[k];
    }
  } else {
    return res.status(400).json({
      success: false,
      message: 'Cannot edit this submission in its current state',
    });
  }

  if (patch.branch_id) {
    const chk = await query(`SELECT id FROM branches WHERE id=$1 AND church_id=$2`, [patch.branch_id, churchId]);
    if (!chk.rows.length) return res.status(400).json({ success: false, message: 'Invalid branch_id' });
  }

  if (patch.project_id !== undefined) {
    if (patch.project_id === null) {
      patch.project_id = null;
    } else {
      const pc = await query(`SELECT id FROM projects WHERE id=$1 AND church_id=$2`, [patch.project_id, churchId]);
      if (!pc.rows.length) return res.status(400).json({ success: false, message: 'Invalid project_id' });
    }
  }

  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  if (!keys.length) return res.json({ success: true, data: row });

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
  vals.push(bid, churchId);

  const upd = await query(
    `UPDATE department_budget_submissions SET ${sets.join(', ')} WHERE id=$${idPh} AND church_id=$${churchPh} RETURNING *`,
    vals
  );
  res.json({ success: true, data: upd.rows[0] });
});

exports.approveDeptBudget = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { bid } = req.params;

  const result = await query(`SELECT * FROM department_budget_submissions WHERE id = $1 AND church_id = $2`, [bid, churchId]);
  if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  const dbs = result.rows[0];

  if (req.branchId && dbs.branch_id !== req.branchId) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const role = req.user.role;
  if (!canApproveDeptBudget(role, dbs.status)) {
    return res.status(403).json({
      success: false,
      message:
        'Your role cannot approve at this stage (1: dept head → 2: coordinating elder → 3: coordinating pastor). Submit the draft first if still in draft.',
    });
  }

  const uid = req.user.id;
  let upd;

  if (dbs.status === 'pending') {
    upd = await query(
      `UPDATE department_budget_submissions
       SET status = 'hod_approved', hod_approved_at = NOW(), hod_approved_by = $1, updated_at = NOW()
       WHERE id = $2 AND church_id = $3 RETURNING *`,
      [uid, bid, churchId]
    );
  } else if (dbs.status === 'hod_approved') {
    upd = await query(
      `UPDATE department_budget_submissions
       SET status = 'elder_approved', elder_approved_at = NOW(), elder_approved_by = $1, updated_at = NOW()
       WHERE id = $2 AND church_id = $3 RETURNING *`,
      [uid, bid, churchId]
    );
  } else if (dbs.status === 'elder_approved') {
    upd = await query(
      `UPDATE department_budget_submissions
       SET status = 'approved', pastor_approved_at = NOW(), pastor_approved_by = $1, updated_at = NOW()
       WHERE id = $2 AND church_id = $3 RETURNING *`,
      [uid, bid, churchId]
    );
  } else {
    return res.status(400).json({
      success: false,
      message: 'This submission is not waiting for an approval step.',
    });
  }

  res.json({ success: true, data: upd.rows[0] });
});

exports.rejectDeptBudget = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { bid } = req.params;
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

  const result = await query(`SELECT * FROM department_budget_submissions WHERE id = $1 AND church_id = $2`, [bid, churchId]);
  if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  const dbs = result.rows[0];

  if (req.branchId && dbs.branch_id !== req.branchId) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  if (!['pending', 'hod_approved', 'elder_approved'].includes(dbs.status)) {
    return res.status(400).json({ success: false, message: 'Cannot reject this submission in its current state' });
  }

  const upd = await query(
    `UPDATE department_budget_submissions
     SET status = 'rejected', rejection_reason = $1, updated_at = NOW()
     WHERE id = $2 AND church_id = $3 RETURNING *`,
    [reason, bid, churchId]
  );

  res.json({ success: true, data: upd.rows[0] });
});

exports.deleteDeptBudget = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { bid } = req.params;

  const cur = await query(`SELECT status, submitted_by FROM department_budget_submissions WHERE id=$1 AND church_id=$2`, [
    bid,
    churchId,
  ]);
  if (!cur.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  const { status: st, submitted_by: submittedBy } = cur.rows[0];

  if (st === 'draft') {
    if (!isManage(req.user.role) && submittedBy !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
  } else if (st === 'rejected') {
    if (!isManage(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only finance/admin can delete rejected submissions' });
    }
  } else {
    return res.status(400).json({ success: false, message: 'Cannot delete a submission in this state' });
  }

  const r = await query(`DELETE FROM department_budget_submissions WHERE id=$1 AND church_id=$2 RETURNING id`, [bid, churchId]);
  if (!r.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, message: 'Deleted' });
});
