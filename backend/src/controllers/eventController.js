const { query, getClient } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

exports.list = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { page = 1, limit = 20, search, status } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  const offset = (parseInt(page, 10) - 1) * lim;

  const conditions = [`e.church_id = $1`];
  const params = [churchId];
  let pi = 2;

  if (req.branchId) {
    conditions.push(`e.branch_id = $${pi++}`);
    params.push(req.branchId);
  }

  if (status) {
    conditions.push(`e.status = $${pi++}`);
    params.push(status);
  }

  if (search) {
    conditions.push(`(e.title ILIKE $${pi} OR e.description ILIKE $${pi} OR e.venue ILIKE $${pi})`);
    params.push(`%${search}%`);
    pi++;
  }

  const where = conditions.join(' AND ');
  const countRes = await query(`SELECT COUNT(*) FROM events e WHERE ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const result = await query(
    `SELECT e.*, b.name AS branch_name
     FROM events e
     JOIN branches b ON e.branch_id = b.id
     WHERE ${where}
     ORDER BY e.event_date DESC, e.created_at DESC
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

  const scoped = req.branchId ? ` AND e.branch_id = $3` : '';
  const params = req.branchId ? [id, churchId, req.branchId] : [id, churchId];

  const result = await query(
    `SELECT e.*, b.name AS branch_name
     FROM events e
     JOIN branches b ON e.branch_id = b.id
     WHERE e.id = $1 AND e.church_id = $2 ${scoped}`,
    params
  );

  if (!result.rows.length) {
    return res.status(404).json({ success: false, message: 'Event not found' });
  }

  res.json({ success: true, data: result.rows[0] });
});

exports.create = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const {
    branch_id,
    title,
    description,
    event_type,
    venue,
    event_date,
    start_time,
    end_time,
    capacity,
    rsvp_required,
    flyer_url,
    status,
  } = req.body;

  if (!title?.trim()) {
    return res.status(400).json({ success: false, message: 'Title is required' });
  }
  if (!event_date) {
    return res.status(400).json({ success: false, message: 'event_date is required' });
  }

  let bid = branch_id || req.branchId;
  if (!bid) {
    return res.status(400).json({
      success: false,
      message: 'branch_id is required (pick a congregation or use the header branch scope).',
    });
  }

  const chk = await query(`SELECT id FROM branches WHERE id = $1 AND church_id = $2`, [bid, churchId]);
  if (!chk.rows.length) {
    return res.status(400).json({ success: false, message: 'Invalid branch' });
  }

  const statuses = ['upcoming', 'ongoing', 'completed', 'cancelled'];
  const st = statuses.includes(status) ? status : 'upcoming';

  const ins = await query(
    `INSERT INTO events (
      church_id, branch_id, title, description, event_type, venue, event_date,
      start_time, end_time, capacity, rsvp_required, flyer_url, status, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    RETURNING *`,
    [
      churchId,
      bid,
      title.trim(),
      description || null,
      event_type?.trim() || null,
      venue?.trim() || null,
      event_date,
      start_time || null,
      end_time || null,
      capacity != null ? parseInt(capacity, 10) : null,
      rsvp_required !== false,
      flyer_url || null,
      st,
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
    'description',
    'event_type',
    'venue',
    'event_date',
    'start_time',
    'end_time',
    'capacity',
    'rsvp_required',
    'flyer_url',
    'status',
    'rsvp_count',
    'is_recurring',
    'recurrence_rule',
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

  const statuses = ['upcoming', 'ongoing', 'completed', 'cancelled'];
  if (patch.status != null && !statuses.includes(patch.status)) delete patch.status;

  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  if (!keys.length) {
    const cur = await query(`SELECT * FROM events WHERE id = $1 AND church_id = $2`, [id, churchId]);
    if (!cur.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, data: cur.rows[0] });
  }

  const sets = [];
  const vals = [];
  let i = 1;
  for (const k of keys) {
    let v = patch[k];
    if (k === 'capacity' && v != null) v = parseInt(v, 10);
    sets.push(`${k} = $${i++}`);
    vals.push(v);
  }
  sets.push('updated_at = NOW()');
  const idPh = i;
  const churchPh = i + 1;
  vals.push(id, churchId);

  const upd = await query(
    `UPDATE events SET ${sets.join(', ')} WHERE id = $${idPh} AND church_id = $${churchPh} RETURNING *`,
    vals
  );

  if (!upd.rows.length) return res.status(404).json({ success: false, message: 'Not found' });

  res.json({ success: true, data: upd.rows[0] });
});

exports.remove = asyncHandler(async (req, res) => {
  const r = await query(`DELETE FROM events WHERE id = $1 AND church_id = $2 RETURNING id`, [
    req.params.id,
    req.user.church_id,
  ]);
  if (!r.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, message: 'Deleted' });
});

exports.listRsvps = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { id } = req.params;

  const ev = await query(`SELECT id FROM events WHERE id = $1 AND church_id = $2`, [id, churchId]);
  if (!ev.rows.length) return res.status(404).json({ success: false, message: 'Event not found' });

  if (req.branchId) {
    const scoped = await query(`SELECT branch_id FROM events WHERE id = $1`, [id]);
    if (scoped.rows[0]?.branch_id !== req.branchId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
  }

  const result = await query(
    `SELECT r.*, m.first_name, m.last_name, m.member_code
     FROM event_rsvps r
     LEFT JOIN members m ON r.member_id = m.id
     WHERE r.event_id = $1
     ORDER BY r.created_at DESC`,
    [id]
  );

  res.json({ success: true, data: result.rows });
});

exports.createRsvp = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { id } = req.params;
  const { member_id, name, email, phone } = req.body;

  const ev = await query(
    `SELECT * FROM events WHERE id = $1 AND church_id = $2`,
    [id, churchId]
  );
  if (!ev.rows.length) return res.status(404).json({ success: false, message: 'Event not found' });

  const event = ev.rows[0];

  if (req.branchId && event.branch_id !== req.branchId) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  if (['completed', 'cancelled'].includes(event.status)) {
    return res.status(400).json({ success: false, message: 'This event is not open for RSVP.' });
  }

  if (!member_id && !name?.trim() && !email?.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Provide member_id or a guest name / email.',
    });
  }

  if (email?.trim()) {
    const dup = await query(
      `SELECT id FROM event_rsvps WHERE event_id = $1 AND LOWER(email) = LOWER($2) AND status <> 'cancelled'`,
      [id, email.trim()]
    );
    if (dup.rows.length) {
      return res.status(409).json({ success: false, message: 'This email is already registered for the event.' });
    }
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const lock = await client.query(
      `SELECT id, capacity, rsvp_required, rsvp_count FROM events WHERE id = $1 AND church_id = $2 FOR UPDATE`,
      [id, churchId]
    );
    if (!lock.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    const e2 = lock.rows[0];

    let st = 'confirmed';
    if (e2.capacity != null && e2.rsvp_count >= e2.capacity) {
      st = 'waitlisted';
    }

    const ins = await client.query(
      `INSERT INTO event_rsvps (event_id, member_id, name, email, phone, status)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        id,
        member_id || null,
        name?.trim() || null,
        email?.trim() ? email.trim().toLowerCase() : null,
        phone?.trim() || null,
        st,
      ]
    );

    if (st === 'confirmed') {
      await client.query(`UPDATE events SET rsvp_count = COALESCE(rsvp_count,0) + 1, updated_at = NOW() WHERE id = $1`, [
        id,
      ]);
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: ins.rows[0], message: st === 'waitlisted' ? 'Added to waitlist' : 'RSVP confirmed' });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
