const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/analytics/dashboard
exports.dashboard = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const scopedBranch = req.branchId;
  const bc = scopedBranch ? 'AND branch_id = $2' : '';
  const bp = scopedBranch ? [churchId, scopedBranch] : [churchId];

  const [members, giving, assets, attendance, sermons] = await Promise.all([
    query(`SELECT
             COUNT(*) AS total,
             COUNT(*) FILTER (WHERE status='active') AS active,
             COUNT(*) FILTER (WHERE membership_date >= DATE_TRUNC('month',NOW())) AS new_this_month
           FROM members WHERE church_id=$1 ${bc}`, bp),

    query(`SELECT
             SUM(amount) AS total_this_month,
             SUM(amount) FILTER (WHERE giving_type='tithe') AS tithes,
             SUM(amount) FILTER (WHERE giving_type='offering') AS offerings,
             SUM(amount) FILTER (WHERE giving_type='special_seed') AS seeds,
             COUNT(*) AS transactions
           FROM giving_records
           WHERE church_id=$1 ${bc}
             AND giving_date >= DATE_TRUNC('month',NOW())`, bp),

    query(`SELECT
             COUNT(*) AS total_assets,
             SUM(current_value) AS total_value,
             COUNT(*) FILTER (WHERE status='maintenance') AS under_maintenance
           FROM assets WHERE church_id=$1 ${bc}`, bp),

    query(`SELECT COUNT(*) AS today
           FROM attendance WHERE church_id=$1 ${bc}
             AND service_date = CURRENT_DATE`, bp),

    query(`SELECT SUM(play_count) AS total_plays, COUNT(*) AS total_sermons
           FROM sermons WHERE church_id=$1 ${bc}`, bp),
  ]);

  res.json({
    success: true,
    data: {
      members: members.rows[0],
      giving: giving.rows[0],
      assets: assets.rows[0],
      attendance: attendance.rows[0],
      sermons: sermons.rows[0],
    },
  });
});

// GET /api/analytics/giving-trend
exports.givingTrend = asyncHandler(async (req, res) => {
  const { year = new Date().getFullYear() } = req.query;
  const churchId = req.user.church_id;
  const scopedBranch = req.branchId;
  const bc = scopedBranch ? 'AND branch_id = $3' : '';
  const params = scopedBranch ? [churchId, year, scopedBranch] : [churchId, year];

  const result = await query(
    `SELECT
       TO_CHAR(giving_date,'Mon') AS month,
       EXTRACT(MONTH FROM giving_date) AS month_num,
       SUM(amount) AS total,
       COUNT(*) AS count
     FROM giving_records
     WHERE church_id=$1 AND EXTRACT(YEAR FROM giving_date)=$2 ${bc}
     GROUP BY month, month_num
     ORDER BY month_num`,
    params
  );
  res.json({ success: true, data: result.rows });
});

// GET /api/analytics/member-growth
exports.memberGrowth = asyncHandler(async (req, res) => {
  const { months = 12 } = req.query;
  const churchId = req.user.church_id;
  const scoped = req.branchId;
  const branchClause = scoped ? 'AND b.id = $3' : '';
  const params = scoped
    ? [churchId, `${months} months`, scoped]
    : [churchId, `${months} months`];

  const result = await query(
    `SELECT
       b.name AS branch,
       COUNT(m.id) AS start_count,
       COUNT(m.id) FILTER (WHERE m.membership_date >= NOW() - $2::INTERVAL) AS new_members
     FROM branches b
     LEFT JOIN members m ON m.branch_id = b.id AND m.church_id = $1
     WHERE b.church_id = $1 ${branchClause}
     GROUP BY b.id, b.name
     ORDER BY start_count DESC`,
    params
  );
  res.json({ success: true, data: result.rows });
});

// GET /api/analytics/attendance-trend
exports.attendanceTrend = asyncHandler(async (req, res) => {
  const { weeks = 8 } = req.query;
  const churchId = req.user.church_id;
  const scopedBranch = req.branchId;
  const bc = scopedBranch ? 'AND a.branch_id = $3' : '';
  const params = scopedBranch ? [churchId, weeks, scopedBranch] : [churchId, weeks];

  const result = await query(
    `SELECT
       service_date,
       service_type,
       COUNT(*) AS count
     FROM attendance a
     WHERE a.church_id=$1 ${bc}
       AND service_date >= NOW() - $2::INTERVAL * '7 days'::INTERVAL
     GROUP BY service_date, service_type
     ORDER BY service_date DESC`,
    params
  );
  res.json({ success: true, data: result.rows });
});

// GET /api/analytics/branch-comparison
exports.branchComparison = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;
  const scoped = req.branchId;
  const branchClause = scoped ? 'AND b.id = $2' : '';
  const params = scoped ? [churchId, scoped] : [churchId];

  const result = await query(
    `SELECT
       b.id, b.name, b.is_headquarters,
       COUNT(DISTINCT m.id) AS member_count,
       COUNT(DISTINCT m.id) FILTER (WHERE m.status='active') AS active_members,
       COALESCE(SUM(g.amount),0) AS total_giving_ytd,
       COUNT(DISTINCT s.id) AS staff_count
     FROM branches b
     LEFT JOIN members m ON m.branch_id = b.id AND m.church_id = $1
     LEFT JOIN giving_records g ON g.branch_id = b.id AND g.church_id = $1
       AND EXTRACT(YEAR FROM g.giving_date) = EXTRACT(YEAR FROM NOW())
     LEFT JOIN staff s ON s.branch_id = b.id AND s.church_id = $1
     WHERE b.church_id = $1 AND b.status = 'active' ${branchClause}
     GROUP BY b.id, b.name, b.is_headquarters
     ORDER BY member_count DESC`,
    params
  );
  res.json({ success: true, data: result.rows });
});

// GET /api/analytics/content
exports.contentAnalytics = asyncHandler(async (req, res) => {
  const churchId = req.user.church_id;

  const [sermons, library] = await Promise.all([
    query(
      `SELECT title, preacher_name, series, sermon_date, play_count, download_count
       FROM sermons WHERE church_id=$1
       ORDER BY play_count DESC LIMIT 10`,
      [churchId]
    ),
    query(
      `SELECT title, author, category, view_count
       FROM library_resources WHERE church_id=$1
       ORDER BY view_count DESC LIMIT 10`,
      [churchId]
    ),
  ]);

  res.json({
    success: true,
    data: { topSermons: sermons.rows, topResources: library.rows },
  });
});
