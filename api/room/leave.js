import { withCors } from '../_lib/cors.js';
import { requirePlayerId } from '../_lib/identity.js';
import { deleteRoom, saveRoom, withRoomLock } from '../_lib/redis.js';
import { removePlayer, getRoomPublicView } from '../_lib/roomManager.js';
import { systemMessage } from '../_lib/chatManager.js';
import { broadcastToRoom } from '../_lib/pusher.js';

export default withCors(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const playerId = requirePlayerId(req, res);
  if (!playerId) return;

  const { roomCode } = req.body || {};
  if (!roomCode) return res.json({ ok: true });

  try {
    await withRoomLock(roomCode, async (room) => {
      if (!room) return;
      const player = removePlayer(room, playerId);
      if (!player) return;

      if (room.players.size === 0 && room.spectators.size === 0) {
        await deleteRoom(room.code);
        return;
      }

      const msg = systemMessage(room, `${player.nickname} left the room`);
      await saveRoom(room);
      await broadcastToRoom(room.code, 'room:updated', { room: getRoomPublicView(room) });
      await broadcastToRoom(room.code, 'chat:message', { message: msg });
    });
  } catch (err) {
    if (err.message !== 'ROOM_LOCKED') throw err;
  }

  res.json({ ok: true });
});
