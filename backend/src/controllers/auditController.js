const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

exports.list = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const {
    page = 1,
    limit = 50,
    action,
    resource_type,
    user_id,
    from_date,
    to_date,
  } = req.query;

  const lim = Math.min(parseInt(limit, 10) || 50, 200);
  const offset = (parseInt(page, 10) - 1) * lim;

  const conditions = [`a.church_id = $1`];
  const params = [churchId];
  let pi = 2;

  if (req.branchId) {
    conditions.push(`(a.branch_id IS NULL OR a.branch_id = $${pi++})`);
    params.push(req.branchId);
  }

  if (action) {
    conditions.push(`a.action = $${pi++}`);
    params.push(action);
  }

  if (resource_type) {
    conditions.push(`a.resource_type ILIKE $${pi++}`);
    params.push(`%${resource_type}%`);
  }

  if (user_id) {
    conditions.push(`a.user_id = $${pi++}`);
    params.push(user_id);
  }

  if (from_date) {
    conditions.push(`a.created_at >= $${pi++}`);
    params.push(from_date);
  }

  if (to_date) {
    conditions.push(`a.created_at < ($${pi++}::date + INTERVAL '1 day')`);
    params.push(to_date);
  }

  const where = conditions.join(' AND ');
  const countRes = await query(`SELECT COUNT(*) FROM audit_logs a WHERE ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const result = await query(
    `SELECT a.*, u.full_name AS user_name, u.email AS user_email
     FROM audit_logs a
     LEFT JOIN users u ON a.user_id = u.id
     WHERE ${where}
     ORDER BY a.created_at DESC
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
  const scoped = req.branchId ? ` AND (a.branch_id IS NULL OR a.branch_id = $3)` : '';
  const params = req.branchId ? [req.params.id, req.user.church_id, req.branchId] : [req.params.id, req.user.church_id];

  const result = await query(
    `SELECT a.*, u.full_name AS user_name FROM audit_logs a LEFT JOIN users u ON a.user_id=u.id
     WHERE a.id=$1 AND a.church_id=$2 ${scoped}`,
    params
  );
  if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: result.rows[0] });
});
