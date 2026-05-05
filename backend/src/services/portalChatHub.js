/** In-memory rooms: one room per member thread (all staff + that member). */

const rooms = new Map(); // memberId -> Set<{ ws, meta }>

function roomKey(memberId) {
  return String(memberId);
}

function join(memberId, ws, meta) {
  const k = roomKey(memberId);
  if (!rooms.has(k)) rooms.set(k, new Set());
  rooms.get(k).add({ ws, meta });
  ws.__portalRoomKey = k;
}

function leave(ws) {
  const k = ws.__portalRoomKey;
  if (!k || !rooms.has(k)) return;
  const set = rooms.get(k);
  for (const entry of [...set]) {
    if (entry.ws === ws) {
      set.delete(entry);
      break;
    }
  }
  if (set.size === 0) rooms.delete(k);
  delete ws.__portalRoomKey;
}

function broadcast(memberId, message, excludeWs = null) {
  const set = rooms.get(roomKey(memberId));
  if (!set) return;
  const data = typeof message === 'string' ? message : JSON.stringify(message);
  for (const { ws } of set) {
    if (ws === excludeWs || ws.readyState !== 1) continue;
    try {
      ws.send(data);
    } catch (_) {
      /* ignore */
    }
  }
}

function notifyChatRefresh(memberId) {
  broadcast(memberId, { type: 'chat:refresh', t: Date.now() });
}

module.exports = { join, leave, broadcast, notifyChatRefresh };
