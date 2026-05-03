const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

exports.list = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { page = 1, limit = 20, search, status } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  const offset = (parseInt(page, 10) - 1) * lim;

  const conditions = [`m.church_id = $1`];
  const params = [churchId];
  let pi = 2;

  if (req.branchId) {
    conditions.push(`(m.branch_id IS NULL OR m.branch_id = $${pi++})`);
    params.push(req.branchId);
  }

  if (status) {
    conditions.push(`m.status = $${pi++}`);
    params.push(status);
  }

  if (search) {
    conditions.push(`(m.title ILIKE $${pi} OR m.description ILIKE $${pi} OR m.host_name ILIKE $${pi})`);
    params.push(`%${search}%`);
    pi++;
  }

  const where = conditions.join(' AND ');
  const countRes = await query(`SELECT COUNT(*) FROM meetings m WHERE ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const result = await query(
    `SELECT m.*, b.name AS branch_name
     FROM meetings m
     LEFT JOIN branches b ON m.branch_id = b.id
     WHERE ${where}
     ORDER BY m.scheduled_start DESC
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, lim, offset]
  );

  res.json({
    success: true,
    data: result.rows,
    pagination: { page: parseInt(page, 10), limit: lim, total, pages: Math.ceil(total / lim) || 1 },
  });
});

exports.getOne = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { id } = req.params;

  const scoped = req.branchId ? ` AND (m.branch_id IS NULL OR m.branch_id = $3)` : '';
  const params = req.branchId ? [id, churchId, req.branchId] : [id, churchId];

  const result = await query(
    `SELECT m.*, b.name AS branch_name
     FROM meetings m
     LEFT JOIN branches b ON m.branch_id = b.id
     WHERE m.id = $1 AND m.church_id = $2 ${scoped}`,
    params
  );

  if (!result.rows.length) {
    return res.status(404).json({ success: false, message: 'Meeting not found' });
  }

  res.json({ success: true, data: result.rows[0] });
});

exports.create = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const {
    branch_id,
    title,
    description,
    meeting_type,
    host_name,
    scheduled_start,
    scheduled_end,
    platform,
    meeting_url,
    is_public,
    access_tier,
    max_attendees,
    status,
  } = req.body;

  if (!title?.trim()) {
    return res.status(400).json({ success: false, message: 'Title is required' });
  }
  if (!scheduled_start) {
    return res.status(400).json({ success: false, message: 'scheduled_start is required' });
  }

  let bid = branch_id;
  if (bid === undefined && req.branchId && req.user.role !== 'super_admin') {
    bid = req.branchId;
  }

  if (bid) {
    const chk = await query(`SELECT id FROM branches WHERE id = $1 AND church_id = $2`, [bid, churchId]);
    if (!chk.rows.length) return res.status(400).json({ success: false, message: 'Invalid branch' });
  }

  const statuses = ['scheduled', 'live', 'ended', 'cancelled'];
  const st = statuses.includes(status) ? status : 'scheduled';

  const ins = await query(
    `INSERT INTO meetings (
      church_id, branch_id, title, description, meeting_type, host_name, host_user_id,
      scheduled_start, scheduled_end, platform, meeting_url, is_public, access_tier,
      max_attendees, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    RETURNING *`,
    [
      churchId,
      bid || null,
      title.trim(),
      description || null,
      meeting_type?.trim() || null,
      host_name?.trim() || null,
      req.user.id,
      scheduled_start,
      scheduled_end || null,
      platform || 'jitsi',
      meeting_url || null,
      is_public !== false,
      access_tier || 'all',
      max_attendees != null ? parseInt(max_attendees, 10) : null,
      st,
    ]
  );

  res.status(201).json({ success: true, data: ins.rows[0] });
});

exports.update = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { id } = req.params;

  const allowed = [
    'branch_id',
    'title',
    'description',
    'meeting_type',
    'host_name',
    'scheduled_start',
    'scheduled_end',
    'actual_start',
    'actual_end',
    'platform',
    'meeting_url',
    'recording_url',
    'is_public',
    'access_tier',
    'max_attendees',
    'status',
  ];

  const patch = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, k)) patch[k] = req.body[k];
  }

  if (patch.branch_id) {
    const chk = await query(`SELECT id FROM branches WHERE id = $1 AND church_id = $2`, [
      patch.branch_id,
      churchId,
    ]);
    if (!chk.rows.length) return res.status(400).json({ success: false, message: 'Invalid branch' });
  }

  const statuses = ['scheduled', 'live', 'ended', 'cancelled'];
  if (patch.status != null && !statuses.includes(patch.status)) delete patch.status;

  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  if (!keys.length) {
    const cur = await query(`SELECT * FROM meetings WHERE id = $1 AND church_id = $2`, [id, churchId]);
    if (!cur.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, data: cur.rows[0] });
  }

  const sets = [];
  const vals = [];
  let i = 1;
  for (const k of keys) {
    let v = patch[k];
    if (k === 'max_attendees' && v != null) v = parseInt(v, 10);
    sets.push(`${k} = $${i++}`);
    vals.push(v);
  }
  sets.push('updated_at = NOW()');
  const idPh = i;
  const churchPh = i + 1;
  vals.push(id, churchId);

  const upd = await query(
    `UPDATE meetings SET ${sets.join(', ')} WHERE id = $${idPh} AND church_id = $${churchPh} RETURNING *`,
    vals
  );

  if (!upd.rows.length) return res.status(404).json({ success: false, message: 'Not found' });

  res.json({ success: true, data: upd.rows[0] });
});

exports.remove = asyncHandler(async (req, res) => {
  const r = await query(`DELETE FROM meetings WHERE id = $1 AND church_id = $2 RETURNING id`, [
    req.params.id,
    req.user.church_id,
  ]);
  if (!r.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, message: 'Deleted' });
});

exports.listAttendance = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { id } = req.params;

  const mt = await query(`SELECT id, branch_id FROM meetings WHERE id = $1 AND church_id = $2`, [
    id,
    churchId,
  ]);
  if (!mt.rows.length) return res.status(404).json({ success: false, message: 'Meeting not found' });

  if (req.branchId && mt.rows[0].branch_id && mt.rows[0].branch_id !== req.branchId) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const result = await query(
    `SELECT a.*, m.first_name, m.last_name
     FROM meeting_attendance a
     LEFT JOIN members m ON a.member_id = m.id
     WHERE a.meeting_id = $1
     ORDER BY a.joined_at DESC`,
    [id]
  );

  res.json({ success: true, data: result.rows });
});

exports.recordAttendance = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { id } = req.params;
  const { member_id, display_name } = req.body;

  const mt = await query(`SELECT id, branch_id FROM meetings WHERE id = $1 AND church_id = $2`, [
    id,
    churchId,
  ]);
  if (!mt.rows.length) return res.status(404).json({ success: false, message: 'Meeting not found' });

  if (req.branchId && mt.rows[0].branch_id && mt.rows[0].branch_id !== req.branchId) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  if (!member_id && !display_name?.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Provide member_id or display_name.',
    });
  }

  if (member_id) {
    const mem = await query(`SELECT id FROM members WHERE id = $1 AND church_id = $2`, [member_id, churchId]);
    if (!mem.rows.length) {
      return res.status(400).json({ success: false, message: 'Invalid member' });
    }
  }

  const ins = await query(
    `INSERT INTO meeting_attendance (meeting_id, member_id, display_name)
     VALUES ($1,$2,$3)
     RETURNING *`,
    [id, member_id || null, display_name?.trim() || null]
  );

  res.status(201).json({ success: true, data: ins.rows[0] });
});
