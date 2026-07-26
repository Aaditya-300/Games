import { withCors } from '../_lib/cors.js';
import { requirePlayerId } from '../_lib/identity.js';
import { withRoomLock, saveRoom } from '../_lib/redis.js';
import { getRoomPublicView } from '../_lib/roomManager.js';
import { removeBot } from '../_lib/botManager.js';
import { systemMessage } from '../_lib/chatManager.js';
import { broadcastToRoom } from '../_lib/pusher.js';

export default withCors(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const playerId = requirePlayerId(req, res);
  if (!playerId) return;

  const { roomCode, botId } = req.body || {};
  if (!roomCode || !botId) return res.status(400).json({ code: 'INVALID_REQUEST' });

  try {
    const result = await withRoomLock(roomCode, async (room) => {
      if (!room) return { error: { code: 'ROOM_NOT_FOUND' } };
      const player = room.players.get(playerId);
      if (!player?.isHost) return { error: { code: 'NOT_HOST', message: 'Only host can remove bots' } };
      const bot = room.players.get(botId);
      if (!bot?.isBot) return { ok: true };

      removeBot(room, botId);
      const msg = systemMessage(room, `${bot.nickname} (Bot) was removed`);
      await saveRoom(room);

      await broadcastToRoom(room.code, 'room:updated', { room: getRoomPublicView(room) });
      await broadcastToRoom(room.code, 'chat:message', { message: msg });
      return { ok: true };
    });

    if (result.error) return res.status(400).json(result.error);
    res.json(result);
  } catch (err) {
    if (err.message === 'ROOM_LOCKED') return res.status(409).json({ code: 'ROOM_LOCKED' });
    throw err;
  }
});
