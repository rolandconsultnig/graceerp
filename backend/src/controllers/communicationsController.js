const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

const CHANNELS = ['sms', 'email', 'push', 'whatsapp', 'in_app', 'all'];
const AUDIENCES = ['all', 'branch', 'department', 'tier', 'custom', 'individual'];
const MSG_STATUSES = ['draft', 'scheduled', 'sending', 'sent', 'failed'];

exports.list = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { page = 1, limit = 20, channel, status, search } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  const offset = (parseInt(page, 10) - 1) * lim;

  const conditions = [`m.church_id = $1`];
  const params = [churchId];
  let pi = 2;

  if (req.branchId) {
    conditions.push(`(m.branch_id IS NULL OR m.branch_id = $${pi++})`);
    params.push(req.branchId);
  }

  if (channel && CHANNELS.includes(channel)) {
    conditions.push(`m.channel = $${pi++}`);
    params.push(channel);
  }

  if (status && MSG_STATUSES.includes(status)) {
    conditions.push(`m.status = $${pi++}`);
    params.push(status);
  }

  if (search) {
    conditions.push(`(m.title ILIKE $${pi} OR m.body ILIKE $${pi})`);
    params.push(`%${search}%`);
    pi++;
  }

  const where = conditions.join(' AND ');
  const countRes = await query(`SELECT COUNT(*) FROM messages m WHERE ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const result = await query(
    `SELECT m.*, b.name AS branch_name
     FROM messages m
     LEFT JOIN branches b ON m.branch_id = b.id
     WHERE ${where}
     ORDER BY m.created_at DESC
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
  const scoped = req.branchId ? ` AND (m.branch_id IS NULL OR m.branch_id = $3)` : '';
  const params = req.branchId ? [req.params.id, req.user.church_id, req.branchId] : [req.params.id, req.user.church_id];

  const result = await query(
    `SELECT m.*, b.name AS branch_name FROM messages m LEFT JOIN branches b ON m.branch_id=b.id
     WHERE m.id=$1 AND m.church_id=$2 ${scoped}`,
    params
  );
  if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: result.rows[0] });
});

exports.create = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const b = req.body;

  if (!b.title?.trim() || !b.body?.trim()) {
    return res.status(400).json({ success: false, message: 'title and body required' });
  }

  const ch = CHANNELS.includes(b.channel) ? b.channel : 'in_app';
  const au = AUDIENCES.includes(b.audience_type) ? b.audience_type : 'all';

  let bid = b.branch_id || null;
  if (bid) {
    const chk = await query(`SELECT id FROM branches WHERE id=$1 AND church_id=$2`, [bid, churchId]);
    if (!chk.rows.length) return res.status(400).json({ success: false, message: 'Invalid branch' });
  }

  const st = MSG_STATUSES.includes(b.status) ? b.status : 'draft';

  const ins = await query(
    `INSERT INTO messages (
      church_id, branch_id, title, body, channel, audience_type, audience_filter,
      status, scheduled_at, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      churchId,
      bid,
      b.title.trim(),
      b.body.trim(),
      ch,
      au,
      b.audience_filter || null,
      st,
      b.scheduled_at || null,
      req.user.id,
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
    'body',
    'channel',
    'audience_type',
    'audience_filter',
    'status',
    'scheduled_at',
    'sent_at',
    'sent_count',
    'delivered_count',
    'read_count',
  ];

  const patch = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, k)) patch[k] = req.body[k];
  }

  if (patch.channel != null && !CHANNELS.includes(patch.channel)) delete patch.channel;
  if (patch.audience_type != null && !AUDIENCES.includes(patch.audience_type)) delete patch.audience_type;
  if (patch.status != null && !MSG_STATUSES.includes(patch.status)) delete patch.status;

  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  if (!keys.length) {
    const cur = await query(`SELECT * FROM messages WHERE id=$1 AND church_id=$2`, [id, churchId]);
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
  vals.push(id, churchId);
  const idPh = i;
  const churchPh = i + 1;

  const upd = await query(
    `UPDATE messages SET ${sets.join(', ')} WHERE id=$${idPh} AND church_id=$${churchPh} RETURNING *`,
    vals
  );
  if (!upd.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: upd.rows[0] });
});

exports.remove = asyncHandler(async (req, res) => {
  const r = await query(`DELETE FROM messages WHERE id=$1 AND church_id=$2 RETURNING id`, [
    req.params.id,
    req.user.church_id,
  ]);
  if (!r.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, message: 'Deleted' });
});

/** Simulate send — marks message sent and increments counters (no real SMS/email gateway). */
exports.send = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { id } = req.params;

  const cur = await query(`SELECT id, status FROM messages WHERE id=$1 AND church_id=$2`, [id, churchId]);
  if (!cur.rows.length) return res.status(404).json({ success: false, message: 'Not found' });

  const upd = await query(
    `UPDATE messages SET status='sent', sent_at=NOW(),
       sent_count = COALESCE(sent_count,0)+1,
       delivered_count = COALESCE(delivered_count,0)+1
     WHERE id=$1 AND church_id=$2 RETURNING *`,
    [id, churchId]
  );

  res.json({ success: true, message: 'Marked as sent (simulated)', data: upd.rows[0] });
});
