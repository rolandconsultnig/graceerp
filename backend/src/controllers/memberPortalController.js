const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

const MEMBER_EDITABLE = [
  'first_name',
  'last_name',
  'middle_name',
  'email',
  'phone',
  'date_of_birth',
  'gender',
  'marital_status',
  'occupation',
  'address',
  'city',
  'state',
  'emergency_contact_name',
  'emergency_contact_phone',
];

async function getMemberRow(req, memberId) {
  const r = await query(
    `SELECT m.* FROM members m WHERE m.id = $1 AND m.church_id = $2`,
    [memberId, req.user.church_id]
  );
  return r.rows[0] || null;
}

function staffCanSeeMember(req, m) {
  if (!m) return false;
  if (req.user.role === 'super_admin') return true;
  const scope = req.branchId || req.user.branch_id;
  if (scope && m.branch_id !== scope) return false;
  return true;
}

// GET /api/member-portal/profile
exports.getProfile = asyncHandler(async (req, res) => {
  const m = req.portalMember;
  const full = await query(
    `SELECT m.*, b.name AS branch_name, c.name AS church_name, c.phone AS church_phone, c.email AS church_email
     FROM members m
     JOIN branches b ON m.branch_id = b.id
     JOIN churches c ON m.church_id = c.id
     WHERE m.id = $1`,
    [m.id]
  );
  res.json({ success: true, data: full.rows[0] });
});

// PUT /api/member-portal/profile
exports.updateProfile = asyncHandler(async (req, res) => {
  const m = req.portalMember;
  const patch = {};
  for (const k of MEMBER_EDITABLE) {
    if (Object.prototype.hasOwnProperty.call(req.body, k)) patch[k] = req.body[k];
  }
  if (Object.keys(patch).length === 0) {
    const cur = await query(
      `SELECT m.*, b.name AS branch_name, c.name AS church_name
       FROM members m JOIN branches b ON m.branch_id = b.id JOIN churches c ON m.church_id = c.id
       WHERE m.id = $1`,
      [m.id]
    );
    return res.json({ success: true, data: cur.rows[0] });
  }

  const sets = [];
  const vals = [];
  let i = 1;
  for (const k of Object.keys(patch)) {
    sets.push(`${k} = $${i++}`);
    vals.push(patch[k]);
  }
  sets.push('updated_at = NOW()');
  vals.push(m.id, req.user.church_id);

  const idPh = i;
  const chPh = i + 1;
  const upd = await query(
    `UPDATE members SET ${sets.join(', ')} WHERE id = $${idPh} AND church_id = $${chPh} RETURNING *`,
    vals
  );
  res.json({ success: true, data: upd.rows[0] });
});

// POST /api/member-portal/profile/photo (multipart field: photo)
exports.uploadPhoto = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Image file required (field name: photo)' });
  }
  const m = req.portalMember;
  const relUrl = `/uploads/members/${req.file.filename}`;

  const upd = await query(
    `UPDATE members SET photo_url = $1, updated_at = NOW() WHERE id = $2 AND church_id = $3 RETURNING *`,
    [relUrl, m.id, req.user.church_id]
  );
  res.json({ success: true, data: upd.rows[0] });
});

// GET /api/member-portal/chat/messages
exports.listMyChat = asyncHandler(async (req, res) => {
  const m = req.portalMember;
  const r = await query(
    `SELECT pcm.id, pcm.is_staff, pcm.staff_user_id, pcm.body, pcm.created_at,
            u.full_name AS staff_name
     FROM member_portal_chat_messages pcm
     LEFT JOIN users u ON pcm.staff_user_id = u.id
     WHERE pcm.member_id = $1 AND pcm.church_id = $2
     ORDER BY pcm.created_at ASC`,
    [m.id, req.user.church_id]
  );
  res.json({ success: true, data: r.rows });
});

// POST /api/member-portal/chat/messages  { body }
exports.postMyMessage = asyncHandler(async (req, res) => {
  const m = req.portalMember;
  const body = (req.body.body || '').trim();
  if (!body) return res.status(400).json({ success: false, message: 'Message body required' });

  const ins = await query(
    `INSERT INTO member_portal_chat_messages (church_id, member_id, is_staff, staff_user_id, body)
     VALUES ($1, $2, false, NULL, $3) RETURNING *`,
    [req.user.church_id, m.id, body]
  );
  res.status(201).json({ success: true, data: ins.rows[0] });
});

// GET /api/member-portal/staff/inbox — members who have at least one chat message
exports.staffInbox = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const scoped = req.branchId ? `AND m.branch_id = $2` : '';
  const params = req.branchId ? [churchId, req.branchId] : [churchId];

  const r = await query(
    `SELECT DISTINCT ON (m.id)
       m.id AS member_id,
       m.first_name,
       m.last_name,
       m.member_code,
       m.branch_id,
       b.name AS branch_name,
       pcm.body AS last_preview,
       pcm.created_at AS last_message_at,
       pcm.is_staff AS last_was_staff
     FROM members m
     JOIN branches b ON m.branch_id = b.id
     JOIN member_portal_chat_messages pcm ON pcm.member_id = m.id
     WHERE m.church_id = $1 ${scoped}
     ORDER BY m.id, pcm.created_at DESC`,
    params
  );

  res.json({ success: true, data: r.rows });
});

// GET /api/member-portal/staff/members/:memberId/messages
exports.staffListThread = asyncHandler(async (req, res) => {
  const memberId = req.params.memberId;
  const member = await getMemberRow(req, memberId);
  if (!member || !staffCanSeeMember(req, member)) {
    return res.status(404).json({ success: false, message: 'Member not found' });
  }

  const r = await query(
    `SELECT pcm.id, pcm.is_staff, pcm.staff_user_id, pcm.body, pcm.created_at,
            u.full_name AS staff_name
     FROM member_portal_chat_messages pcm
     LEFT JOIN users u ON pcm.staff_user_id = u.id
     WHERE pcm.member_id = $1 AND pcm.church_id = $2
     ORDER BY pcm.created_at ASC`,
    [memberId, req.user.church_id]
  );
  res.json({
    success: true,
    data: r.rows,
    member: {
      id: member.id,
      first_name: member.first_name,
      last_name: member.last_name,
      member_code: member.member_code,
      branch_id: member.branch_id,
    },
  });
});

// POST /api/member-portal/staff/members/:memberId/messages  { body }
exports.staffReply = asyncHandler(async (req, res) => {
  const memberId = req.params.memberId;
  const member = await getMemberRow(req, memberId);
  if (!member || !staffCanSeeMember(req, member)) {
    return res.status(404).json({ success: false, message: 'Member not found' });
  }

  const body = (req.body.body || '').trim();
  if (!body) return res.status(400).json({ success: false, message: 'Message body required' });

  const ins = await query(
    `INSERT INTO member_portal_chat_messages (church_id, member_id, is_staff, staff_user_id, body)
     VALUES ($1, $2, true, $3, $4) RETURNING *`,
    [req.user.church_id, memberId, req.user.id, body]
  );

  const row = ins.rows[0];
  row.staff_name = req.user.full_name;
  res.status(201).json({ success: true, data: row });
});
