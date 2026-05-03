const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

exports.list = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { page = 1, limit = 20, search, category, format } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  const offset = (parseInt(page, 10) - 1) * lim;

  const conditions = [`lr.church_id = $1`];
  const params = [churchId];
  let pi = 2;

  if (category) {
    conditions.push(`lr.category ILIKE $${pi++}`);
    params.push(`%${category}%`);
  }

  if (format) {
    conditions.push(`lr.format = $${pi++}`);
    params.push(format);
  }

  if (search) {
    conditions.push(`(lr.title ILIKE $${pi} OR lr.author ILIKE $${pi} OR lr.description ILIKE $${pi})`);
    params.push(`%${search}%`);
    pi++;
  }

  const where = conditions.join(' AND ');
  const countRes = await query(`SELECT COUNT(*) FROM library_resources lr WHERE ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const result = await query(
    `SELECT lr.*
     FROM library_resources lr
     WHERE ${where}
     ORDER BY lr.created_at DESC
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

  const bump = await query(
    `UPDATE library_resources SET view_count = COALESCE(view_count, 0) + 1, updated_at = NOW()
     WHERE id = $1 AND church_id = $2
     RETURNING *`,
    [id, churchId]
  );

  if (!bump.rows.length) {
    return res.status(404).json({ success: false, message: 'Resource not found' });
  }

  res.json({ success: true, data: bump.rows[0] });
});

exports.create = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const {
    title,
    author,
    description,
    category,
    format,
    file_url,
    file_size_bytes,
    cover_url,
    access_tier,
    download_allowed,
    tags,
  } = req.body;

  if (!title?.trim()) {
    return res.status(400).json({ success: false, message: 'Title is required' });
  }

  const formats = ['pdf', 'epub', 'docx', 'mp3', 'mp4', 'other'];
  const fmt = formats.includes(format) ? format : 'pdf';

  const tiers = ['all', 'cell_leader', 'minister', 'pastor', 'admin'];
  const tier = tiers.includes(access_tier) ? access_tier : 'all';

  let fsb = null;
  if (file_size_bytes != null && file_size_bytes !== '') {
    const n = parseInt(file_size_bytes, 10);
    fsb = Number.isFinite(n) ? n : null;
  }

  const ins = await query(
    `INSERT INTO library_resources (
      church_id, title, author, description, category, format, file_url, file_size_bytes,
      cover_url, access_tier, download_allowed, tags, uploaded_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING *`,
    [
      churchId,
      title.trim(),
      author?.trim() || null,
      description || null,
      category?.trim() || null,
      fmt,
      file_url || null,
      fsb,
      cover_url || null,
      tier,
      !!download_allowed,
      Array.isArray(tags) ? tags : null,
      req.user.id,
    ]
  );

  res.status(201).json({ success: true, data: ins.rows[0] });
});

exports.update = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { id } = req.params;

  const allowed = [
    'title',
    'author',
    'description',
    'category',
    'format',
    'file_url',
    'file_size_bytes',
    'cover_url',
    'access_tier',
    'download_allowed',
    'tags',
    'view_count',
  ];

  const patch = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, k)) patch[k] = req.body[k];
  }

  const formats = ['pdf', 'epub', 'docx', 'mp3', 'mp4', 'other'];
  if (patch.format != null && !formats.includes(patch.format)) delete patch.format;

  const tiers = ['all', 'cell_leader', 'minister', 'pastor', 'admin'];
  if (patch.access_tier != null && !tiers.includes(patch.access_tier)) delete patch.access_tier;

  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  if (!keys.length) {
    const cur = await query(`SELECT * FROM library_resources WHERE id = $1 AND church_id = $2`, [
      id,
      churchId,
    ]);
    if (!cur.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, data: cur.rows[0] });
  }

  const sets = [];
  const vals = [];
  let i = 1;
  for (const k of keys) {
    let v = patch[k];
    if (k === 'file_size_bytes' && v != null) v = parseInt(v, 10);
    sets.push(`${k} = $${i++}`);
    vals.push(v);
  }
  sets.push('updated_at = NOW()');
  const idPh = i;
  const churchPh = i + 1;
  vals.push(id, churchId);

  const upd = await query(
    `UPDATE library_resources SET ${sets.join(', ')} WHERE id = $${idPh} AND church_id = $${churchPh} RETURNING *`,
    vals
  );

  if (!upd.rows.length) return res.status(404).json({ success: false, message: 'Not found' });

  res.json({ success: true, data: upd.rows[0] });
});

exports.remove = asyncHandler(async (req, res) => {
  const r = await query(`DELETE FROM library_resources WHERE id = $1 AND church_id = $2 RETURNING id`, [
    req.params.id,
    req.user.church_id,
  ]);
  if (!r.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, message: 'Deleted' });
});
