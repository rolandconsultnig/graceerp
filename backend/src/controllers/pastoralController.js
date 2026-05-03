const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const PRAYER_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const FLAG_TYPES = ['financial', 'medical', 'emotional', 'bereavement', 'other'];
const WELFARE_STATUSES = ['open', 'in_progress', 'resolved'];

/* ── Prayer requests ─────────────────────────────────────────────────────────── */

exports.listPrayers = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { page = 1, limit = 20, status, priority, search } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  const offset = (parseInt(page, 10) - 1) * lim;

  const params = [churchId];
  let pi = 2;

  let bc = '';
  if (req.branchId) {
    bc = ` AND p.branch_id = $${pi++}`;
    params.push(req.branchId);
  }

  const filters = [];
  if (status && PRAYER_STATUSES.includes(status)) {
    filters.push(`p.status = $${pi++}`);
    params.push(status);
  }
  if (priority && PRIORITIES.includes(priority)) {
    filters.push(`p.priority = $${pi++}`);
    params.push(priority);
  }
  if (search) {
    filters.push(`(p.title ILIKE $${pi} OR p.description ILIKE $${pi})`);
    params.push(`%${search}%`);
    pi++;
  }

  const where = `p.church_id = $1 ${bc} ${filters.length ? ' AND ' + filters.join(' AND ') : ''}`;
  const countRes = await query(`SELECT COUNT(*) FROM prayer_requests p WHERE ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const result = await query(
    `SELECT p.*, b.name AS branch_name,
            m.first_name AS mf, m.last_name AS ml
     FROM prayer_requests p
     JOIN branches b ON p.branch_id = b.id
     LEFT JOIN members m ON p.member_id = m.id
     WHERE ${where}
     ORDER BY p.created_at DESC
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, lim, offset]
  );

  res.json({
    success: true,
    data: result.rows,
    pagination: { page: parseInt(page, 10), limit: lim, total, pages: Math.ceil(total / lim) || 1 },
  });
});

exports.getPrayer = asyncHandler(async (req, res) => {
  const scoped = req.branchId ? ` AND p.branch_id = $3` : '';
  const params = req.branchId ? [req.params.id, req.user.church_id, req.branchId] : [req.params.id, req.user.church_id];

  const result = await query(
    `SELECT p.*, b.name AS branch_name FROM prayer_requests p JOIN branches b ON p.branch_id=b.id
     WHERE p.id=$1 AND p.church_id=$2 ${scoped}`,
    params
  );
  if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: result.rows[0] });
});

exports.createPrayer = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const b = req.body;
  if (!b.title?.trim()) return res.status(400).json({ success: false, message: 'title required' });

  let bid = b.branch_id || req.branchId;
  if (!bid) return res.status(400).json({ success: false, message: 'branch_id required' });

  const chk = await query(`SELECT id FROM branches WHERE id=$1 AND church_id=$2`, [bid, churchId]);
  if (!chk.rows.length) return res.status(400).json({ success: false, message: 'Invalid branch' });

  const pr = PRIORITIES.includes(b.priority) ? b.priority : 'medium';
  const st = PRAYER_STATUSES.includes(b.status) ? b.status : 'open';

  const ins = await query(
    `INSERT INTO prayer_requests (
      church_id, branch_id, member_id, title, description, is_confidential, priority, assigned_to, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      churchId,
      bid,
      b.member_id || null,
      b.title.trim(),
      b.description || null,
      !!b.is_confidential,
      pr,
      b.assigned_to || null,
      st,
    ]
  );

  res.status(201).json({ success: true, data: ins.rows[0] });
});

exports.updatePrayer = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { id } = req.params;

  const allowed = [
    'branch_id',
    'member_id',
    'title',
    'description',
    'is_confidential',
    'priority',
    'assigned_to',
    'status',
    'resolved_at',
    'resolution_note',
  ];

  const patch = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, k)) patch[k] = req.body[k];
  }

  if (patch.priority != null && !PRIORITIES.includes(patch.priority)) delete patch.priority;
  if (patch.status != null && !PRAYER_STATUSES.includes(patch.status)) delete patch.status;

  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  if (!keys.length) {
    const cur = await query(`SELECT * FROM prayer_requests WHERE id=$1 AND church_id=$2`, [id, churchId]);
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
    `UPDATE prayer_requests SET ${sets.join(', ')} WHERE id=$${idPh} AND church_id=$${churchPh} RETURNING *`,
    vals
  );
  if (!upd.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: upd.rows[0] });
});

exports.deletePrayer = asyncHandler(async (req, res) => {
  const r = await query(`DELETE FROM prayer_requests WHERE id=$1 AND church_id=$2 RETURNING id`, [
    req.params.id,
    req.user.church_id,
  ]);
  if (!r.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, message: 'Deleted' });
});

/* ── Pastoral visits ─────────────────────────────────────────────────────────── */

exports.listVisits = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { page = 1, limit = 20 } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  const offset = (parseInt(page, 10) - 1) * lim;

  const params = [churchId];
  let pi = 2;
  let bc = '';
  if (req.branchId) {
    bc = ` AND v.branch_id = $${pi++}`;
    params.push(req.branchId);
  }

  const where = `v.church_id = $1 ${bc}`;
  const countRes = await query(`SELECT COUNT(*) FROM pastoral_visits v WHERE ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const result = await query(
    `SELECT v.*, b.name AS branch_name,
            m.first_name AS mf, m.last_name AS ml, u.full_name AS visitor_name
     FROM pastoral_visits v
     JOIN branches b ON v.branch_id = b.id
     JOIN members m ON v.member_id = m.id
     JOIN users u ON v.visited_by = u.id
     WHERE ${where}
     ORDER BY v.visit_date DESC, v.created_at DESC
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, lim, offset]
  );

  res.json({
    success: true,
    data: result.rows,
    pagination: { page: parseInt(page, 10), limit: lim, total, pages: Math.ceil(total / lim) || 1 },
  });
});

exports.getVisit = asyncHandler(async (req, res) => {
  const scoped = req.branchId ? ` AND v.branch_id=$3` : '';
  const params = req.branchId ? [req.params.id, req.user.church_id, req.branchId] : [req.params.id, req.user.church_id];

  const result = await query(
    `SELECT v.*, b.name AS branch_name FROM pastoral_visits v JOIN branches b ON v.branch_id=b.id
     WHERE v.id=$1 AND v.church_id=$2 ${scoped}`,
    params
  );
  if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: result.rows[0] });
});

exports.createVisit = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const b = req.body;

  if (!b.member_id || !b.visit_date) {
    return res.status(400).json({ success: false, message: 'member_id and visit_date required' });
  }

  let bid = b.branch_id || req.branchId;
  if (!bid) return res.status(400).json({ success: false, message: 'branch_id required' });

  const chk = await query(`SELECT id FROM branches WHERE id=$1 AND church_id=$2`, [bid, churchId]);
  if (!chk.rows.length) return res.status(400).json({ success: false, message: 'Invalid branch' });

  const mem = await query(`SELECT id FROM members WHERE id=$1 AND church_id=$2`, [b.member_id, churchId]);
  if (!mem.rows.length) return res.status(400).json({ success: false, message: 'Invalid member' });

  const ins = await query(
    `INSERT INTO pastoral_visits (church_id, branch_id, member_id, visited_by, visit_date, purpose, notes, follow_up_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      churchId,
      bid,
      b.member_id,
      req.user.id,
      b.visit_date,
      b.purpose?.trim() || null,
      b.notes || null,
      b.follow_up_date || null,
    ]
  );

  res.status(201).json({ success: true, data: ins.rows[0] });
});

exports.deleteVisit = asyncHandler(async (req, res) => {
  const r = await query(`DELETE FROM pastoral_visits WHERE id=$1 AND church_id=$2 RETURNING id`, [
    req.params.id,
    req.user.church_id,
  ]);
  if (!r.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, message: 'Deleted' });
});

/* ── Welfare flags ───────────────────────────────────────────────────────────── */

exports.listWelfare = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { page = 1, limit = 20, status } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  const offset = (parseInt(page, 10) - 1) * lim;

  const params = [churchId];
  let pi = 2;
  let bc = '';
  if (req.branchId) {
    bc = ` AND w.branch_id = $${pi++}`;
    params.push(req.branchId);
  }

  const filters = [];
  if (status && WELFARE_STATUSES.includes(status)) {
    filters.push(`w.status = $${pi++}`);
    params.push(status);
  }

  const where = `w.church_id = $1 ${bc} ${filters.length ? ' AND ' + filters.join(' AND ') : ''}`;
  const countRes = await query(`SELECT COUNT(*) FROM welfare_flags w WHERE ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const result = await query(
    `SELECT w.*, b.name AS branch_name,
            m.first_name AS mf, m.last_name AS ml
     FROM welfare_flags w
     JOIN branches b ON w.branch_id = b.id
     JOIN members m ON w.member_id = m.id
     WHERE ${where}
     ORDER BY w.created_at DESC
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, lim, offset]
  );

  res.json({
    success: true,
    data: result.rows,
    pagination: { page: parseInt(page, 10), limit: lim, total, pages: Math.ceil(total / lim) || 1 },
  });
});

exports.getWelfare = asyncHandler(async (req, res) => {
  const scoped = req.branchId ? ` AND w.branch_id=$3` : '';
  const params = req.branchId ? [req.params.id, req.user.church_id, req.branchId] : [req.params.id, req.user.church_id];

  const result = await query(
    `SELECT w.*, b.name AS branch_name FROM welfare_flags w JOIN branches b ON w.branch_id=b.id
     WHERE w.id=$1 AND w.church_id=$2 ${scoped}`,
    params
  );
  if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: result.rows[0] });
});

exports.createWelfare = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const b = req.body;

  if (!b.member_id) return res.status(400).json({ success: false, message: 'member_id required' });

  let bid = b.branch_id || req.branchId;
  if (!bid) return res.status(400).json({ success: false, message: 'branch_id required' });

  const chk = await query(`SELECT id FROM branches WHERE id=$1 AND church_id=$2`, [bid, churchId]);
  if (!chk.rows.length) return res.status(400).json({ success: false, message: 'Invalid branch' });

  const mem = await query(`SELECT id FROM members WHERE id=$1 AND church_id=$2`, [b.member_id, churchId]);
  if (!mem.rows.length) return res.status(400).json({ success: false, message: 'Invalid member' });

  const ft = FLAG_TYPES.includes(b.flag_type) ? b.flag_type : 'other';
  const st = WELFARE_STATUSES.includes(b.status) ? b.status : 'open';

  const ins = await query(
    `INSERT INTO welfare_flags (church_id, branch_id, member_id, flag_type, description, assigned_to, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [churchId, bid, b.member_id, ft, b.description || null, b.assigned_to || null, st]
  );

  res.status(201).json({ success: true, data: ins.rows[0] });
});

exports.updateWelfare = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { id } = req.params;

  const allowed = ['branch_id', 'member_id', 'flag_type', 'description', 'assigned_to', 'status'];
  const patch = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, k)) patch[k] = req.body[k];
  }

  if (patch.flag_type != null && !FLAG_TYPES.includes(patch.flag_type)) delete patch.flag_type;
  if (patch.status != null && !WELFARE_STATUSES.includes(patch.status)) delete patch.status;

  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  if (!keys.length) {
    const cur = await query(`SELECT * FROM welfare_flags WHERE id=$1 AND church_id=$2`, [id, churchId]);
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
    `UPDATE welfare_flags SET ${sets.join(', ')} WHERE id=$${idPh} AND church_id=$${churchPh} RETURNING *`,
    vals
  );
  if (!upd.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: upd.rows[0] });
});

exports.deleteWelfare = asyncHandler(async (req, res) => {
  const r = await query(`DELETE FROM welfare_flags WHERE id=$1 AND church_id=$2 RETURNING id`, [
    req.params.id,
    req.user.church_id,
  ]);
  if (!r.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, message: 'Deleted' });
});

/** Open prayer/welfare items + overdue visit follow-ups (for nav badges). Respects branchScope. */
exports.summary = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const branchId = req.branchId || null;

  const bc = branchId ? ' AND branch_id = $2' : '';
  const params2 = branchId ? [churchId, branchId] : [churchId];

  const [prayer, welfare, followups] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS c FROM prayer_requests
       WHERE church_id = $1 ${bc} AND status IN ('open','in_progress')`,
      params2
    ),
    query(
      `SELECT COUNT(*)::int AS c FROM welfare_flags
       WHERE church_id = $1 ${bc} AND status IN ('open','in_progress')`,
      params2
    ),
    query(
      `SELECT COUNT(*)::int AS c FROM pastoral_visits
       WHERE church_id = $1 ${bc}
         AND follow_up_date IS NOT NULL
         AND follow_up_date <= CURRENT_DATE`,
      params2
    ),
  ]);

  const open_prayers = prayer.rows[0].c;
  const open_welfare = welfare.rows[0].c;
  const followups_due = followups.rows[0].c;
  const open_total = open_prayers + open_welfare + followups_due;

  res.json({
    success: true,
    data: {
      open_prayers,
      open_welfare,
      followups_due,
      open_total,
    },
  });
});
