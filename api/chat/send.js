import { withCors } from '../_lib/cors.js';
import { requirePlayerId } from '../_lib/identity.js';
import { withRoomLock, saveRoom } from '../_lib/redis.js';
import { addMessage } from '../_lib/chatManager.js';
import { broadcastToRoom } from '../_lib/pusher.js';

export default withCors(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const playerId = requirePlayerId(req, res);
  if (!playerId) return;

  const { roomCode, text } = req.body || {};
  if (!roomCode || !text?.trim()) return res.json({ ok: true });

  try {
    await withRoomLock(roomCode, async (room) => {
      const player = room?.players.get(playerId) || room?.spectators.get(playerId);
      if (!room || !player) return;

      const trimmed = text.trim().slice(0, 300);
      const msg = addMessage(room, playerId, player.nickname, trimmed);
      await saveRoom(room);
      await broadcastToRoom(room.code, 'chat:message', { message: msg });
    });
  } catch (err) {
    if (err.message !== 'ROOM_LOCKED') throw err;
  }

  res.json({ ok: true });
});
