const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/finance/giving
exports.getAllGiving = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, giving_type, payment_method,
          date_from, date_to, member_id } = req.query;
  const offset = (page - 1) * limit;

  const conditions = ['g.church_id = $1'];
  const params = [req.user.church_id];
  let pi = 2;

  const scopedBranch = req.branchId;
  if (scopedBranch) { conditions.push(`g.branch_id = $${pi++}`); params.push(scopedBranch); }
  if (giving_type) { conditions.push(`g.giving_type = $${pi++}`); params.push(giving_type); }
  if (payment_method) { conditions.push(`g.payment_method = $${pi++}`); params.push(payment_method); }
  if (member_id) { conditions.push(`g.member_id = $${pi++}`); params.push(member_id); }
  if (date_from) { conditions.push(`g.giving_date >= $${pi++}`); params.push(date_from); }
  if (date_to)   { conditions.push(`g.giving_date <= $${pi++}`); params.push(date_to); }

  const where = conditions.join(' AND ');
  const countRes = await query(`SELECT COUNT(*) FROM giving_records g WHERE ${where}`, params);

  const result = await query(
    `SELECT g.*, 
            m.first_name || ' ' || m.last_name AS member_name,
            b.name AS branch_name,
            u.full_name AS recorded_by_name
     FROM giving_records g
     LEFT JOIN members m ON g.member_id = m.id
     LEFT JOIN branches b ON g.branch_id = b.id
     LEFT JOIN users u ON g.recorded_by = u.id
     WHERE ${where}
     ORDER BY g.giving_date DESC, g.created_at DESC
     LIMIT $${pi} OFFSET $${pi+1}`,
    [...params, parseInt(limit), offset]
  );

  res.json({
    success: true,
    data: result.rows,
    pagination: {
      page: parseInt(page), limit: parseInt(limit),
      total: parseInt(countRes.rows[0].count),
      pages: Math.ceil(countRes.rows[0].count / limit)
    },
  });
});

// POST /api/finance/giving
exports.recordGiving = asyncHandler(async (req, res) => {
  const {
    member_id, giving_type, amount, currency, payment_method,
    transaction_ref, giving_date, branch_id, notes
  } = req.body;

  if (!giving_type || !amount) {
    return res.status(400).json({ success: false, message: 'giving_type and amount required' });
  }

  const rcptNum = `RCP-${Date.now()}`;
  const targetBranch = req.branchId || branch_id;

  if (!targetBranch) {
    return res.status(400).json({
      success: false,
      message: 'branch_id is required when recording giving as a congregation-wide administrator.',
    });
  }

  const result = await query(
    `INSERT INTO giving_records
      (church_id, branch_id, member_id, giving_type, amount, currency,
       payment_method, transaction_ref, receipt_number, giving_date, notes, recorded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [req.user.church_id, targetBranch, member_id, giving_type, amount,
     currency || 'NGN', payment_method || 'cash', transaction_ref,
     rcptNum, giving_date || new Date(), notes, req.user.id]
  );

  // Double-entry ledger
  await query(
    `INSERT INTO ledger_entries
      (church_id, branch_id, entry_date, description, debit_account, credit_account,
       amount, currency, reference_id, reference_type, created_by)
     VALUES ($1,$2,$3,$4,'Cash/Bank','Tithes & Offerings Income',$5,$6,$7,'giving',$8)`,
    [req.user.church_id, targetBranch, giving_date || new Date(),
     `${giving_type} - ${rcptNum}`, amount, currency || 'NGN',
     result.rows[0].id, req.user.id]
  );

  res.status(201).json({
    success: true, message: 'Giving recorded',
    data: result.rows[0],
  });
});

// GET /api/finance/giving/:id
exports.getGiving = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT g.*,
            m.first_name || ' ' || m.last_name AS member_name,
            m.email AS member_email, m.phone AS member_phone,
            b.name AS branch_name, u.full_name AS recorded_by_name
     FROM giving_records g
     LEFT JOIN members m ON g.member_id = m.id
     LEFT JOIN branches b ON g.branch_id = b.id
     LEFT JOIN users u ON g.recorded_by = u.id
     WHERE g.id = $1 AND g.church_id = $2`,
    [req.params.id, req.user.church_id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Record not found' });
  }
  res.json({ success: true, data: result.rows[0] });
});

// GET /api/finance/summary
exports.summary = asyncHandler(async (req, res) => {
  const { year = new Date().getFullYear(), month } = req.query;
  const scopedBranch = req.branchId;
  const branchClause = scopedBranch ? 'AND branch_id = $3' : '';
  const params = scopedBranch
    ? [req.user.church_id, year, scopedBranch]
    : [req.user.church_id, year];

  const result = await query(
    `SELECT
       giving_type,
       SUM(amount) AS total,
       COUNT(*) AS transactions,
       AVG(amount) AS average
     FROM giving_records
     WHERE church_id = $1
       AND EXTRACT(YEAR FROM giving_date) = $2
       ${branchClause}
     GROUP BY giving_type`,
    params
  );

  const monthly = await query(
    `SELECT
       EXTRACT(MONTH FROM giving_date) AS month,
       SUM(amount) AS total,
       COUNT(*) AS transactions
     FROM giving_records
     WHERE church_id = $1 AND EXTRACT(YEAR FROM giving_date) = $2
       ${branchClause}
     GROUP BY EXTRACT(MONTH FROM giving_date)
     ORDER BY month`,
    params
  );

  res.json({
    success: true,
    data: { byType: result.rows, monthly: monthly.rows },
  });
});

// GET /api/finance/ledger
exports.getLedger = asyncHandler(async (req, res) => {
  const { page = 1, limit = 30, date_from, date_to } = req.query;
  const offset = (page - 1) * limit;

  const conditions = ['l.church_id = $1'];
  const params = [req.user.church_id];
  let pi = 2;

  if (req.branchId) { conditions.push(`l.branch_id = $${pi++}`); params.push(req.branchId); }
  if (date_from) { conditions.push(`l.entry_date >= $${pi++}`); params.push(date_from); }
  if (date_to)   { conditions.push(`l.entry_date <= $${pi++}`); params.push(date_to); }

  const where = conditions.join(' AND ');
  const countRes = await query(`SELECT COUNT(*) FROM ledger_entries l WHERE ${where}`, params);

  const result = await query(
    `SELECT l.*, u.full_name AS created_by_name
     FROM ledger_entries l
     LEFT JOIN users u ON l.created_by = u.id
     WHERE ${where}
     ORDER BY l.entry_date DESC, l.created_at DESC
     LIMIT $${pi} OFFSET $${pi+1}`,
    [...params, parseInt(limit), offset]
  );

  const total = parseInt(countRes.rows[0].count, 10);
  res.json({
    success: true,
    data: result.rows,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  });
});
