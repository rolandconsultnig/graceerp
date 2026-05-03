const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

exports.list = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { page = 1, limit = 20, search, series } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  const offset = (parseInt(page, 10) - 1) * lim;

  const conditions = [`s.church_id = $1`];
  const params = [churchId];
  let pi = 2;

  if (req.branchId) {
    conditions.push(`(s.branch_id IS NULL OR s.branch_id = $${pi++})`);
    params.push(req.branchId);
  }

  if (series) {
    conditions.push(`s.series ILIKE $${pi++}`);
    params.push(`%${series}%`);
  }

  if (search) {
    conditions.push(
      `(s.title ILIKE $${pi} OR s.preacher_name ILIKE $${pi} OR s.scripture_ref ILIKE $${pi})`
    );
    params.push(`%${search}%`);
    pi++;
  }

  const where = conditions.join(' AND ');
  const countRes = await query(`SELECT COUNT(*) FROM sermons s WHERE ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const result = await query(
    `SELECT s.*, b.name AS branch_name
     FROM sermons s
     LEFT JOIN branches b ON s.branch_id = b.id
     WHERE ${where}
     ORDER BY s.sermon_date DESC NULLS LAST, s.created_at DESC
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

  const scoped = req.branchId
    ? ` AND (branch_id IS NULL OR branch_id = $3)`
    : '';
  const params = req.branchId ? [id, churchId, req.branchId] : [id, churchId];

  const bump = await query(
    `UPDATE sermons SET play_count = COALESCE(play_count, 0) + 1, updated_at = NOW()
     WHERE id = $1 AND church_id = $2 ${scoped}
     RETURNING *`,
    params
  );

  if (!bump.rows.length) {
    return res.status(404).json({ success: false, message: 'Sermon not found' });
  }

  const row = bump.rows[0];
  const b = row.branch_id
    ? await query(`SELECT name FROM branches WHERE id = $1`, [row.branch_id])
    : { rows: [] };
  row.branch_name = b.rows[0]?.name || null;

  res.json({ success: true, data: row });
});

exports.create = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const {
    branch_id,
    title,
    preacher_name,
    series,
    scripture_ref,
    sermon_date,
    duration_minutes,
    description,
    tags,
    audio_url,
    video_url,
    transcript_url,
    thumbnail_url,
    download_allowed,
    access_tier,
    language,
  } = req.body;

  if (!title?.trim() || !preacher_name?.trim()) {
    return res.status(400).json({ success: false, message: 'Title and preacher name are required' });
  }
  if (!sermon_date) {
    return res.status(400).json({ success: false, message: 'sermon_date is required' });
  }

  let bid = branch_id || null;
  if (!bid && req.branchId && req.user.role !== 'super_admin') {
    bid = req.branchId;
  }

  if (bid) {
    const chk = await query(`SELECT id FROM branches WHERE id = $1 AND church_id = $2`, [bid, churchId]);
    if (!chk.rows.length) {
      return res.status(400).json({ success: false, message: 'Invalid branch' });
    }
  }

  const tiers = ['all', 'cell_leader', 'minister', 'pastor', 'admin'];
  const tier = tiers.includes(access_tier) ? access_tier : 'all';

  const ins = await query(
    `INSERT INTO sermons (
      church_id, branch_id, title, preacher_name, series, scripture_ref, sermon_date,
      duration_minutes, description, tags, audio_url, video_url, transcript_url, thumbnail_url,
      download_allowed, access_tier, language, uploaded_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
    RETURNING *`,
    [
      churchId,
      bid,
      title.trim(),
      preacher_name.trim(),
      series?.trim() || null,
      scripture_ref?.trim() || null,
      sermon_date,
      duration_minutes != null ? parseInt(duration_minutes, 10) : null,
      description || null,
      Array.isArray(tags) ? tags : null,
      audio_url || null,
      video_url || null,
      transcript_url || null,
      thumbnail_url || null,
      download_allowed !== false,
      tier,
      language || 'English',
      req.user.id,
    ]
  );

  res.status(201).json({ success: true, data: ins.rows[0] });
});

exports.update = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const { id } = req.params;

  const fields = [
    'branch_id',
    'title',
    'preacher_name',
    'series',
    'scripture_ref',
    'sermon_date',
    'duration_minutes',
    'description',
    'tags',
    'audio_url',
    'video_url',
    'transcript_url',
    'thumbnail_url',
    'download_allowed',
    'access_tier',
    'language',
    'play_count',
    'download_count',
  ];

  const patch = {};
  for (const k of fields) {
    if (Object.prototype.hasOwnProperty.call(req.body, k)) patch[k] = req.body[k];
  }

  if (patch.branch_id !== undefined && patch.branch_id !== null) {
    const chk = await query(`SELECT id FROM branches WHERE id = $1 AND church_id = $2`, [
      patch.branch_id,
      churchId,
    ]);
    if (!chk.rows.length) {
      return res.status(400).json({ success: false, message: 'Invalid branch' });
    }
  }

  const tiers = ['all', 'cell_leader', 'minister', 'pastor', 'admin'];
  if (patch.access_tier != null && !tiers.includes(patch.access_tier)) {
    delete patch.access_tier;
  }

  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  if (!keys.length) {
    const cur = await query(`SELECT * FROM sermons WHERE id = $1 AND church_id = $2`, [id, churchId]);
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
    `UPDATE sermons SET ${sets.join(', ')} WHERE id = $${idPh} AND church_id = $${churchPh} RETURNING *`,
    vals
  );

  if (!upd.rows.length) {
    return res.status(404).json({ success: false, message: 'Not found' });
  }

  res.json({ success: true, data: upd.rows[0] });
});

exports.remove = asyncHandler(async (req, res) => {
  const r = await query(`DELETE FROM sermons WHERE id = $1 AND church_id = $2 RETURNING id`, [
    req.params.id,
    req.user.church_id,
  ]);
  if (!r.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, message: 'Deleted' });
});
