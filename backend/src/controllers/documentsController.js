const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

exports.list = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { page = 1, limit = 20, search, category, document_type } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  const offset = (parseInt(page, 10) - 1) * lim;

  const conditions = [`d.church_id = $1`];
  const params = [churchId];
  let pi = 2;

  if (req.branchId) {
    conditions.push(`(d.branch_id IS NULL OR d.branch_id = $${pi++})`);
    params.push(req.branchId);
  }

  if (category) {
    conditions.push(`d.category ILIKE $${pi++}`);
    params.push(`%${category}%`);
  }

  if (document_type) {
    conditions.push(`d.document_type = $${pi++}`);
    params.push(document_type);
  }

  if (search) {
    conditions.push(`d.title ILIKE $${pi++}`);
    params.push(`%${search}%`);
  }

  const where = conditions.join(' AND ');
  const countRes = await query(`SELECT COUNT(*) FROM documents d WHERE ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const result = await query(
    `SELECT d.*, b.name AS branch_name
     FROM documents d
     LEFT JOIN branches b ON d.branch_id = b.id
     WHERE ${where}
     ORDER BY d.created_at DESC
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
  const scoped = req.branchId ? ` AND (d.branch_id IS NULL OR d.branch_id = $3)` : '';
  const params = req.branchId ? [req.params.id, req.user.church_id, req.branchId] : [req.params.id, req.user.church_id];

  const result = await query(
    `SELECT d.*, b.name AS branch_name FROM documents d LEFT JOIN branches b ON d.branch_id=b.id
     WHERE d.id=$1 AND d.church_id=$2 ${scoped}`,
    params
  );
  if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: result.rows[0] });
});

exports.createJson = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const b = req.body;

  if (!b.title?.trim()) return res.status(400).json({ success: false, message: 'title required' });

  let bid = b.branch_id || null;
  if (bid) {
    const chk = await query(`SELECT id FROM branches WHERE id=$1 AND church_id=$2`, [bid, churchId]);
    if (!chk.rows.length) return res.status(400).json({ success: false, message: 'Invalid branch' });
  }

  const ins = await query(
    `INSERT INTO documents (
      church_id, branch_id, title, document_type, category, file_url, file_size_bytes,
      version, access_role, tags, expiry_date, uploaded_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [
      churchId,
      bid,
      b.title.trim(),
      b.document_type?.trim() || null,
      b.category?.trim() || null,
      b.file_url?.trim() || null,
      b.file_size_bytes != null ? parseInt(b.file_size_bytes, 10) : null,
      b.version != null ? parseInt(b.version, 10) : 1,
      b.access_role?.trim() || 'branch_admin',
      Array.isArray(b.tags) ? b.tags : null,
      b.expiry_date || null,
      req.user.id,
    ]
  );

  res.status(201).json({ success: true, data: ins.rows[0] });
});

exports.createUploaded = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'file required (multipart field name: file)' });
  }

  const relUrl = `/uploads/documents/${req.file.filename}`;
  const title = req.body.title?.trim() || req.file.originalname || 'Uploaded document';

  let bid = req.body.branch_id || null;
  if (bid === '') bid = null;
  if (bid) {
    const chk = await query(`SELECT id FROM branches WHERE id=$1 AND church_id=$2`, [bid, churchId]);
    if (!chk.rows.length) return res.status(400).json({ success: false, message: 'Invalid branch' });
  }

  let tags = null;
  if (req.body.tags) {
    try {
      tags = JSON.parse(req.body.tags);
    } catch {
      tags = req.body.tags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  const ins = await query(
    `INSERT INTO documents (
      church_id, branch_id, title, document_type, category, file_url, file_size_bytes,
      version, access_role, tags, expiry_date, uploaded_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [
      churchId,
      bid,
      title,
      req.body.document_type?.trim() || null,
      req.body.category?.trim() || null,
      relUrl,
      req.file.size || null,
      req.body.version != null ? parseInt(req.body.version, 10) : 1,
      req.body.access_role?.trim() || 'branch_admin',
      tags,
      req.body.expiry_date || null,
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
    'document_type',
    'category',
    'file_url',
    'file_size_bytes',
    'version',
    'access_role',
    'tags',
    'expiry_date',
  ];

  const patch = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, k)) patch[k] = req.body[k];
  }

  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  if (!keys.length) {
    const cur = await query(`SELECT * FROM documents WHERE id=$1 AND church_id=$2`, [id, churchId]);
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
    `UPDATE documents SET ${sets.join(', ')} WHERE id=$${idPh} AND church_id=$${churchPh} RETURNING *`,
    vals
  );
  if (!upd.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: upd.rows[0] });
});

exports.remove = asyncHandler(async (req, res) => {
  const r = await query(`DELETE FROM documents WHERE id=$1 AND church_id=$2 RETURNING id`, [
    req.params.id,
    req.user.church_id,
  ]);
  if (!r.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, message: 'Deleted' });
});
