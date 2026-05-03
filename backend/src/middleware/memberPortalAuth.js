const { query } = require('../config/database');

/** Requires JWT user.role === `member` and a linked `members.user_id` row. Sets `req.portalMember`. */
async function requireMemberPortal(req, res, next) {
  try {
    if (req.user.role !== 'member') {
      return res.status(403).json({
        success: false,
        message: 'The member portal is only available to congregation accounts.',
      });
    }

    const r = await query(
      `SELECT m.* FROM members m WHERE m.user_id = $1 AND m.church_id = $2`,
      [req.user.id, req.user.church_id]
    );

    if (!r.rows.length) {
      return res.status(403).json({
        success: false,
        message:
          'Your account is not linked to a member profile yet. Ask your church office to connect your login.',
      });
    }

    req.portalMember = r.rows[0];
    next();
  } catch (e) {
    next(e);
  }
}

const STAFF_CHAT_ROLES = ['super_admin', 'branch_admin', 'pastor'];

function authorizeStaffChat(req, res, next) {
  if (!STAFF_CHAT_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }
  next();
}

module.exports = { requireMemberPortal, authorizeStaffChat, STAFF_CHAT_ROLES };
