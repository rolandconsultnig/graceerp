const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

exports.listFacilities = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { page = 1, limit = 20, search } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  const offset = (parseInt(page, 10) - 1) * lim;

  const conditions = [`f.church_id = $1`];
  const params = [churchId];
  let pi = 2;

  if (req.branchId) {
    conditions.push(`f.branch_id = $${pi++}`);
    params.push(req.branchId);
  }

  if (search) {
    conditions.push(`(f.name ILIKE $${pi} OR f.description ILIKE $${pi})`);
    params.push(`%${search}%`);
    pi++;
  }

  const where = conditions.join(' AND ');
  const countRes = await query(`SELECT COUNT(*) FROM facilities f WHERE ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const result = await query(
    `SELECT f.*, b.name AS branch_name
     FROM facilities f JOIN branches b ON f.branch_id = b.id
     WHERE ${where}
     ORDER BY f.created_at DESC
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, lim, offset]
  );

  res.json({
    success: true,
    data: result.rows,
    pagination: { page: parseInt(page, 10), limit: lim, total, pages: Math.ceil(total / lim) || 1 },
  });
});

exports.getFacility = asyncHandler(async (req, res) => {
  const scoped = req.branchId ? ` AND f.branch_id = $3` : '';
  const params = req.branchId ? [req.params.id, req.user.church_id, req.branchId] : [req.params.id, req.user.church_id];

  const result = await query(
    `SELECT f.*, b.name AS branch_name FROM facilities f JOIN branches b ON f.branch_id = b.id
     WHERE f.id = $1 AND f.church_id = $2 ${scoped}`,
    params
  );
  if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: result.rows[0] });
});

exports.createFacility = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { branch_id, name, facility_type, capacity, description, amenities, photo_url, is_active } = req.body;

  if (!name?.trim()) return res.status(400).json({ success: false, message: 'name required' });

  let bid = branch_id || req.branchId;
  if (!bid) return res.status(400).json({ success: false, message: 'branch_id required' });

  const chk = await query(`SELECT id FROM branches WHERE id=$1 AND church_id=$2`, [bid, churchId]);
  if (!chk.rows.length) return res.status(400).json({ success: false, message: 'Invalid branch' });

  const ins = await query(
    `INSERT INTO facilities (church_id, branch_id, name, facility_type, capacity, description, amenities, photo_url, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      churchId,
      bid,
      name.trim(),
      facility_type?.trim() || null,
      capacity != null ? parseInt(capacity, 10) : null,
      description || null,
      Array.isArray(amenities) ? amenities : null,
      photo_url?.trim() || null,
      is_active !== false,
    ]
  );

  res.status(201).json({ success: true, data: ins.rows[0] });
});

exports.updateFacility = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { id } = req.params;

  const allowed = ['branch_id', 'name', 'facility_type', 'capacity', 'description', 'amenities', 'photo_url', 'is_active'];
  const patch = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, k)) patch[k] = req.body[k];
  }

  if (patch.branch_id) {
    const chk = await query(`SELECT id FROM branches WHERE id=$1 AND church_id=$2`, [patch.branch_id, churchId]);
    if (!chk.rows.length) return res.status(400).json({ success: false, message: 'Invalid branch' });
  }

  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  if (!keys.length) {
    const cur = await query(`SELECT * FROM facilities WHERE id=$1 AND church_id=$2`, [id, churchId]);
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
  vals.push(id, churchId);
  const idPh = i;
  const churchPh = i + 1;

  const upd = await query(
    `UPDATE facilities SET ${sets.join(', ')} WHERE id=$${idPh} AND church_id=$${churchPh} RETURNING *`,
    vals
  );
  if (!upd.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: upd.rows[0] });
});

exports.deleteFacility = asyncHandler(async (req, res) => {
  const r = await query(`DELETE FROM facilities WHERE id=$1 AND church_id=$2 RETURNING id`, [
    req.params.id,
    req.user.church_id,
  ]);
  if (!r.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, message: 'Deleted' });
});

async function facilityInChurch(facilityId, churchId, branchScope) {
  const sql = branchScope
    ? `SELECT f.id, f.branch_id FROM facilities f WHERE f.id=$1 AND f.church_id=$2 AND f.branch_id=$3`
    : `SELECT f.id, f.branch_id FROM facilities f WHERE f.id=$1 AND f.church_id=$2`;
  const params = branchScope ? [facilityId, churchId, branchScope] : [facilityId, churchId];
  const r = await query(sql, params);
  return r.rows[0];
}

exports.listBookings = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { page = 1, limit = 25, facility_id, status, from_date } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 25, 150);
  const offset = (parseInt(page, 10) - 1) * lim;

  const conditions = [`f.church_id = $1`];
  const params = [churchId];
  let pi = 2;

  if (req.branchId) {
    conditions.push(`f.branch_id = $${pi++}`);
    params.push(req.branchId);
  }

  if (facility_id) {
    conditions.push(`fb.facility_id = $${pi++}`);
    params.push(facility_id);
  }

  if (status && ['pending', 'confirmed', 'cancelled'].includes(status)) {
    conditions.push(`fb.status = $${pi++}`);
    params.push(status);
  }

  if (from_date) {
    conditions.push(`fb.booking_date >= $${pi++}`);
    params.push(from_date);
  }

  const where = conditions.join(' AND ');
  const countRes = await query(
    `SELECT COUNT(*) FROM facility_bookings fb
     JOIN facilities f ON fb.facility_id = f.id
     WHERE ${where}`,
    params
  );
  const total = parseInt(countRes.rows[0].count, 10);

  const result = await query(
    `SELECT fb.*, f.name AS facility_name, f.branch_id
     FROM facility_bookings fb
     JOIN facilities f ON fb.facility_id = f.id
     WHERE ${where}
     ORDER BY fb.booking_date DESC, fb.start_time DESC
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, lim, offset]
  );

  res.json({
    success: true,
    data: result.rows,
    pagination: { page: parseInt(page, 10), limit: lim, total, pages: Math.ceil(total / lim) || 1 },
  });
});

exports.createBooking = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const {
    facility_id,
    event_name,
    booking_date,
    start_time,
    end_time,
    setup_mins,
    teardown_mins,
    attendee_count,
    purpose,
    status,
  } = req.body;

  if (!facility_id || !booking_date || !start_time || !end_time) {
    return res.status(400).json({ success: false, message: 'facility_id, booking_date, start_time, end_time required' });
  }

  const fac = await facilityInChurch(facility_id, churchId, req.branchId || null);
  if (!fac) return res.status(404).json({ success: false, message: 'Facility not found' });
  if (req.branchId && fac.branch_id !== req.branchId) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const st = ['pending', 'confirmed', 'cancelled'].includes(status) ? status : 'pending';

  const ins = await query(
    `INSERT INTO facility_bookings (
      facility_id, booked_by, event_name, booking_date, start_time, end_time,
      setup_mins, teardown_mins, attendee_count, purpose, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      facility_id,
      req.user.id,
      event_name?.trim() || null,
      booking_date,
      start_time,
      end_time,
      setup_mins ?? 30,
      teardown_mins ?? 30,
      attendee_count != null ? parseInt(attendee_count, 10) : null,
      purpose || null,
      st,
    ]
  );

  res.status(201).json({ success: true, data: ins.rows[0] });
});

exports.updateBooking = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { bookingId } = req.params;

  const chk = await query(
    `SELECT fb.id FROM facility_bookings fb
     JOIN facilities f ON fb.facility_id = f.id
     WHERE fb.id=$1 AND f.church_id=$2`,
    [bookingId, churchId]
  );
  if (!chk.rows.length) return res.status(404).json({ success: false, message: 'Not found' });

  const allowed = [
    'event_name',
    'booking_date',
    'start_time',
    'end_time',
    'setup_mins',
    'teardown_mins',
    'attendee_count',
    'purpose',
    'status',
    'approved_by',
  ];

  const patch = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, k)) patch[k] = req.body[k];
  }

  if (patch.status != null && !['pending', 'confirmed', 'cancelled'].includes(patch.status)) delete patch.status;

  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  if (!keys.length) {
    const cur = await query(
      `SELECT fb.* FROM facility_bookings fb JOIN facilities f ON fb.facility_id=f.id WHERE fb.id=$1 AND f.church_id=$2`,
      [bookingId, churchId]
    );
    return res.json({ success: true, data: cur.rows[0] });
  }

  const sets = [];
  const vals = [];
  let i = 1;
  for (const k of keys) {
    sets.push(`${k} = $${i++}`);
    vals.push(patch[k]);
  }
  vals.push(bookingId);

  await query(`UPDATE facility_bookings SET ${sets.join(', ')} WHERE id = $${i}`, vals);

  const fresh = await query(`SELECT * FROM facility_bookings WHERE id=$1`, [bookingId]);
  res.json({ success: true, data: fresh.rows[0] });
});

exports.deleteBooking = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { bookingId } = req.params;

  const chk = await query(
    `SELECT fb.id FROM facility_bookings fb
     JOIN facilities f ON fb.facility_id = f.id
     WHERE fb.id=$1 AND f.church_id=$2`,
    [bookingId, churchId]
  );
  if (!chk.rows.length) return res.status(404).json({ success: false, message: 'Not found' });

  await query(`DELETE FROM facility_bookings WHERE id=$1`, [bookingId]);
  res.json({ success: true, message: 'Deleted' });
});
