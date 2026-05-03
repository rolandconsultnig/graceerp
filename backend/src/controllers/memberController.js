const { query, getClient } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/members
exports.getAll = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, tier, department, status } = req.query;
  const offset = (page - 1) * limit;

  const scopedBranch = req.branchId;
  const conditions = ['m.church_id = $1'];
  const params = [req.user.church_id];
  let pi = 2;

  if (scopedBranch) { conditions.push(`m.branch_id = $${pi++}`); params.push(scopedBranch); }
  if (tier)   { conditions.push(`m.tier = $${pi++}`); params.push(tier); }
  if (department) { conditions.push(`m.department ILIKE $${pi++}`); params.push(`%${department}%`); }
  if (status) { conditions.push(`m.status = $${pi++}`); params.push(status); }
  if (search) {
    conditions.push(`(m.first_name ILIKE $${pi} OR m.last_name ILIKE $${pi} OR m.email ILIKE $${pi} OR m.member_code ILIKE $${pi})`);
    params.push(`%${search}%`); pi++;
  }

  const where = conditions.join(' AND ');
  const countRes = await query(`SELECT COUNT(*) FROM members m WHERE ${where}`, params);
  const total = parseInt(countRes.rows[0].count);

  const result = await query(
    `SELECT m.id, m.member_code, m.first_name, m.last_name, m.email, m.phone,
            m.gender, m.tier, m.department, m.status, m.membership_date,
            m.photo_url, m.created_at, b.name AS branch_name
     FROM members m
     LEFT JOIN branches b ON m.branch_id = b.id
     WHERE ${where}
     ORDER BY m.created_at DESC
     LIMIT $${pi} OFFSET $${pi+1}`,
    [...params, parseInt(limit), offset]
  );

  res.json({
    success: true,
    data: result.rows,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total/limit) },
  });
});

// GET /api/members/:id
exports.getOne = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT m.*, b.name AS branch_name, c.name AS church_name
     FROM members m
     LEFT JOIN branches b ON m.branch_id = b.id
     LEFT JOIN churches c ON m.church_id = c.id
     WHERE m.id = $1 AND m.church_id = $2`,
    [req.params.id, req.user.church_id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Member not found' });
  }
  res.json({ success: true, data: result.rows[0] });
});

// POST /api/members
exports.create = asyncHandler(async (req, res) => {
  const {
    first_name, last_name, middle_name, email, phone, date_of_birth,
    gender, marital_status, occupation, address, city, state,
    salvation_date, baptism_date, tier, department, cell_group,
    branch_id, emergency_contact_name, emergency_contact_phone
  } = req.body;

  if (!first_name || !last_name) {
    return res.status(400).json({ success: false, message: 'First and last name required' });
  }

  const targetBranch = req.branchId || branch_id;
  const code = `MBR-${Date.now().toString().slice(-6)}`;

  const result = await query(
    `INSERT INTO members (church_id, branch_id, member_code, first_name, last_name,
      middle_name, email, phone, date_of_birth, gender, marital_status, occupation,
      address, city, state, salvation_date, baptism_date, tier, department, cell_group,
      membership_date, emergency_contact_name, emergency_contact_phone)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
             $18,$19,$20,CURRENT_DATE,$21,$22)
     RETURNING *`,
    [req.user.church_id, targetBranch, code, first_name, last_name,
     middle_name, email, phone, date_of_birth, gender, marital_status, occupation,
     address, city, state, salvation_date, baptism_date, tier || 'general_member',
     department, cell_group, emergency_contact_name, emergency_contact_phone]
  );

  res.status(201).json({ success: true, message: 'Member created', data: result.rows[0] });
});

// PUT /api/members/:id
exports.update = asyncHandler(async (req, res) => {
  const fields = ['first_name','last_name','middle_name','email','phone',
                  'date_of_birth','gender','marital_status','occupation',
                  'address','city','state','photo_url','salvation_date','baptism_date',
                  'tier','department','cell_group','status',
                  'emergency_contact_name','emergency_contact_phone','notes'];

  const updates = [];
  const params = [];
  let pi = 1;

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = $${pi++}`);
      params.push(req.body[field]);
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ success: false, message: 'No fields to update' });
  }

  params.push(req.params.id, req.user.church_id);

  const result = await query(
    `UPDATE members SET ${updates.join(', ')}
     WHERE id = $${pi} AND church_id = $${pi+1}
     RETURNING *`,
    params
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Member not found' });
  }

  res.json({ success: true, message: 'Member updated', data: result.rows[0] });
});

// DELETE /api/members/:id (soft delete — mark inactive)
exports.remove = asyncHandler(async (req, res) => {
  const result = await query(
    `UPDATE members SET status='inactive' WHERE id=$1 AND church_id=$2 RETURNING id`,
    [req.params.id, req.user.church_id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Member not found' });
  }
  res.json({ success: true, message: 'Member deactivated' });
});

// GET /api/members/stats
exports.stats = asyncHandler(async (req, res) => {
  const scopedBranch = req.branchId;
  const branchClause = scopedBranch ? 'AND branch_id = $2' : '';
  const params = scopedBranch ? [req.user.church_id, scopedBranch] : [req.user.church_id];

  const result = await query(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status='active') AS active,
       COUNT(*) FILTER (WHERE status='inactive') AS inactive,
       COUNT(*) FILTER (WHERE membership_date >= DATE_TRUNC('month', NOW())) AS new_this_month,
       COUNT(*) FILTER (WHERE tier='cell_leader') AS cell_leaders,
       COUNT(*) FILTER (WHERE tier IN ('minister','pastor','exec_pastor','bishop')) AS ministers
     FROM members WHERE church_id = $1 ${branchClause}`,
    params
  );
  res.json({ success: true, data: result.rows[0] });
});

// POST /api/members/:id/photo (multipart field: photo)
exports.uploadMemberPhoto = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Image file required (field name: photo)' });
  }
  const memberId = req.params.id;
  const row = await query(
    `SELECT id, branch_id FROM members WHERE id = $1 AND church_id = $2`,
    [memberId, req.user.church_id]
  );
  if (row.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Member not found' });
  }
  const m = row.rows[0];
  if (req.branchId && m.branch_id !== req.branchId) {
    return res.status(403).json({ success: false, message: 'Cannot update this member' });
  }
  const relUrl = `/uploads/members/${req.file.filename}`;
  const upd = await query(
    `UPDATE members SET photo_url = $1, updated_at = NOW() WHERE id = $2 AND church_id = $3 RETURNING *`,
    [relUrl, memberId, req.user.church_id]
  );
  res.json({ success: true, data: upd.rows[0] });
});
