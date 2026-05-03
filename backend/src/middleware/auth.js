const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const logger = require('../utils/logger');

// Verify JWT and attach user to request
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Load fresh user from DB on each request
    const result = await query(
      `SELECT u.id, u.email, u.full_name, u.role, u.church_id, u.branch_id,
              u.is_active, b.name AS branch_name, c.name AS church_name
       FROM users u
       LEFT JOIN branches b ON u.branch_id = b.id
       LEFT JOIN churches c ON u.church_id = c.id
       WHERE u.id = $1 AND u.is_active = true`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    logger.error('Auth middleware error', err);
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Role-based access control
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}`,
      });
    }
    next();
  };
};

// Branch isolation — non-super-admins can only access their own branch data
const branchScope = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    req.branchId = req.user.branch_id;
  } else {
    // Super admin can filter by branch via query param, or see all
    req.branchId = req.query.branch_id || null;
  }
  next();
};

module.exports = { authenticate, authorize, branchScope };
