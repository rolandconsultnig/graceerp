const WebSocket = require('ws');
const { URL } = require('url');
const jwt = require('jsonwebtoken');
const { query } = require('./config/database');
const hub = require('./services/portalChatHub');
const { STAFF_CHAT_ROLES } = require('./middleware/memberPortalAuth');

function staffCanSeeMember(user, memberRow) {
  if (!memberRow) return false;
  if (user.role === 'super_admin') return true;
  const scope = user.branch_id;
  if (scope && memberRow.branch_id !== scope) return false;
  return true;
}

async function loadUser(userId) {
  const result = await query(
    `SELECT u.id, u.email, u.full_name, u.role, u.church_id, u.branch_id, u.is_active
     FROM users u WHERE u.id = $1 AND u.is_active = true`,
    [userId]
  );
  return result.rows[0] || null;
}

async function loadPortalMember(userId, churchId) {
  const r = await query(
    `SELECT m.* FROM members m WHERE m.user_id = $1 AND m.church_id = $2`,
    [userId, churchId]
  );
  return r.rows[0] || null;
}

function attachPortalChatWebSocket(server) {
  const wss = new WebSocket.Server({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const host = request.headers.host || 'localhost';
    let pathname;
    try {
      pathname = new URL(request.url, `http://${host}`).pathname;
    } catch {
      socket.destroy();
      return;
    }
    if (pathname !== '/ws/portal-chat') {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', async (ws, request) => {
    const host = request.headers.host || 'localhost';
    let url;
    try {
      url = new URL(request.url, `http://${host}`);
    } catch {
      ws.close(4400, 'bad url');
      return;
    }

    const token = url.searchParams.get('token');
    const memberId = url.searchParams.get('memberId');
    const role = url.searchParams.get('role');

    if (!token || !memberId || !role) {
      ws.close(4400, 'missing params');
      return;
    }

    let user;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      user = await loadUser(decoded.userId);
      if (!user) throw new Error('no user');
    } catch {
      ws.close(4401, 'unauthorized');
      return;
    }

    try {
      if (role === 'member') {
        if (user.role !== 'member') {
          ws.close(4403, 'role');
          return;
        }
        const pm = await loadPortalMember(user.id, user.church_id);
        if (!pm || String(pm.id) !== String(memberId)) {
          ws.close(4403, 'member scope');
          return;
        }
        hub.join(memberId, ws, { role: 'member', userId: user.id });
      } else if (role === 'staff') {
        if (!STAFF_CHAT_ROLES.includes(user.role)) {
          ws.close(4403, 'staff only');
          return;
        }
        const mr = await query(
          `SELECT * FROM members WHERE id = $1 AND church_id = $2`,
          [memberId, user.church_id]
        );
        const memberRow = mr.rows[0];
        if (!staffCanSeeMember(user, memberRow)) {
          ws.close(4403, 'branch');
          return;
        }
        hub.join(memberId, ws, { role: 'staff', userId: user.id });
      } else {
        ws.close(4400, 'role');
        return;
      }
    } catch {
      ws.close(1011, 'server');
      return;
    }

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.type === 'portal-signal') {
        hub.broadcast(memberId, msg, ws);
      }
      if (msg.type === 'typing') {
        hub.broadcast(memberId, { type: 'typing', fromRole: role }, ws);
      }
    });

    ws.on('close', () => hub.leave(ws));

    try {
      ws.send(JSON.stringify({ type: 'portal-chat-ready', memberId: String(memberId) }));
    } catch (_) {
      /* ignore */
    }
  });

  return wss;
}

module.exports = { attachPortalChatWebSocket };
