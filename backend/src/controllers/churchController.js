const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

const SELECTABLE = `
  id, name, tagline, address, city, state, country, phone, email, website,
  logo_url, currency, founded_year, is_active, created_at, updated_at`;

// GET /api/churches — tenant church for the authenticated user
exports.list = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT ${SELECTABLE} FROM churches WHERE id = $1`,
    [req.user.church_id]
  );
  res.json({ success: true, data: result.rows, count: result.rowCount });
});

// GET /api/churches/:id
exports.getOne = asyncHandler(async (req, res) => {
  if (req.params.id !== req.user.church_id) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }
  const result = await query(
    `SELECT ${SELECTABLE} FROM churches WHERE id = $1`,
    [req.params.id]
  );
  if (!result.rows.length) {
    return res.status(404).json({ success: false, message: 'Church not found' });
  }
  res.json({ success: true, data: result.rows[0] });
});

// PUT /api/churches/:id — congregation profile (super admin only)
exports.update = asyncHandler(async (req, res) => {
  if (req.params.id !== req.user.church_id) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const b = req.body;
  const fields = [];
  const params = [];
  let i = 1;

  const assign = (col, val, norm = (x) => x) => {
    if (val === undefined) return;
    fields.push(`${col} = $${i++}`);
    params.push(norm(val));
  };

  if (b.name !== undefined) {
    const n = String(b.name).trim();
    if (!n) {
      return res.status(400).json({ success: false, message: 'name cannot be empty' });
    }
    fields.push(`name = $${i++}`);
    params.push(n);
  }
  if (b.tagline !== undefined) assign('tagline', b.tagline, (v) => (v == null ? null : String(v)));
  if (b.address !== undefined) assign('address', b.address, (v) => (v == null ? null : String(v)));
  if (b.city !== undefined) assign('city', b.city, (v) => (v == null ? null : String(v)));
  if (b.state !== undefined) assign('state', b.state, (v) => (v == null ? null : String(v)));
  if (b.country !== undefined) assign('country', b.country, (v) => (v == null ? null : String(v)));
  if (b.phone !== undefined) assign('phone', b.phone, (v) => (v == null ? null : String(v)));
  if (b.email !== undefined) assign('email', b.email, (v) => (v == null ? null : String(v)));
  if (b.website !== undefined) assign('website', b.website, (v) => (v == null ? null : String(v)));
  if (b.logo_url !== undefined) assign('logo_url', b.logo_url, (v) => (v == null ? null : String(v)));
  if (b.currency !== undefined) assign('currency', b.currency, (v) => (v == null ? null : String(v)));
  if (b.founded_year !== undefined) {
    let fy = null;
    if (b.founded_year !== '' && b.founded_year != null) {
      fy = parseInt(b.founded_year, 10);
      if (Number.isNaN(fy)) {
        return res.status(400).json({ success: false, message: 'founded_year must be a number' });
      }
    }
    fields.push(`founded_year = $${i++}`);
    params.push(fy);
  }
  if (b.is_active !== undefined) assign('is_active', b.is_active, (v) => Boolean(v));

  if (!fields.length) {
    return res.status(400).json({ success: false, message: 'No valid fields to update' });
  }

  params.push(req.params.id);
  const result = await query(
    `UPDATE churches SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${i}
     RETURNING ${SELECTABLE}`,
    params
  );

  if (!result.rows.length) {
    return res.status(404).json({ success: false, message: 'Church not found' });
  }
  res.json({ success: true, data: result.rows[0] });
});
