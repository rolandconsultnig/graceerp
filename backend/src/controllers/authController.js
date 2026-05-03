const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const generateTokens = (userId) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });
  return { token, refreshToken };
};

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password required' });
  }

  const result = await query(
    `SELECT u.*, b.name AS branch_name, c.name AS church_name
     FROM users u
     LEFT JOIN branches b ON u.branch_id = b.id
     LEFT JOIN churches c ON u.church_id = c.id
     WHERE u.email = $1`,
    [email.toLowerCase().trim()]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const user = result.rows[0];

  if (!user.is_active) {
    return res.status(401).json({ success: false, message: 'Account is deactivated' });
  }

  if (!user.password_hash) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const { token, refreshToken } = generateTokens(user.id);

  // Store refresh token & update last login
  await query(
    'UPDATE users SET refresh_token=$1, last_login=NOW() WHERE id=$2',
    [refreshToken, user.id]
  );

  logger.info(`User logged in: ${user.email}`);

  const { password_hash, refresh_token, ...safeUser } = user;

  res.json({
    success: true,
    message: 'Login successful',
    data: { token, refreshToken, user: safeUser },
  });
});

// POST /api/auth/refresh
exports.refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'Refresh token required' });
  }

  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

  const result = await query(
    'SELECT id, email, role, is_active FROM users WHERE id=$1 AND refresh_token=$2',
    [decoded.userId, refreshToken]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }

  const user = result.rows[0];
  if (!user.is_active) {
    return res.status(401).json({ success: false, message: 'Account deactivated' });
  }

  const tokens = generateTokens(user.id);
  await query('UPDATE users SET refresh_token=$1 WHERE id=$2', [tokens.refreshToken, user.id]);

  res.json({ success: true, data: tokens });
});

// POST /api/auth/logout
exports.logout = asyncHandler(async (req, res) => {
  await query('UPDATE users SET refresh_token=NULL WHERE id=$1', [req.user.id]);
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/auth/me
exports.me = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT u.id, u.email, u.full_name, u.role, u.church_id, u.branch_id,
             u.last_login, u.created_at,
             b.name AS branch_name, c.name AS church_name, c.currency,
             (SELECT m.id FROM members m WHERE m.user_id = u.id AND m.church_id = u.church_id LIMIT 1) AS member_id
     FROM users u
     LEFT JOIN branches b ON u.branch_id = b.id
     LEFT JOIN churches c ON u.church_id = c.id
     WHERE u.id = $1`,
    [req.user.id]
  );
  res.json({ success: true, data: result.rows[0] });
});

// POST /api/auth/change-password
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const result = await query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
  const isMatch = await bcrypt.compare(currentPassword, result.rows[0].password_hash);

  if (!isMatch) {
    return res.status(400).json({ success: false, message: 'Current password incorrect' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);

  res.json({ success: true, message: 'Password changed successfully' });
});
