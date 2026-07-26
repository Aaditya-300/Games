import { withCors } from '../_lib/cors.js';
import { requirePlayerId } from '../_lib/identity.js';
import { withRoomLock, saveRoom } from '../_lib/redis.js';
import { drawCards } from '../_lib/cardEffects.js';
import { broadcastToRoom } from '../_lib/pusher.js';
import { broadcastHandUpdate } from '../_lib/gameFlow.js';

export default withCors(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const playerId = requirePlayerId(req, res);
  if (!playerId) return;

  const { roomCode, targetId } = req.body || {};
  if (!roomCode) return res.status(400).json({ code: 'INVALID_REQUEST' });

  try {
    await withRoomLock(roomCode, async (room) => {
      if (!room?.gameState) return;
      const gs = room.gameState;

      if (targetId && targetId !== playerId) {
        // Catching another player who hasn't called UNO.
        const target = room.players.get(targetId);
        if (!target) return;
        if (target.hand.length !== 1) return;
        if (gs.unoCalled.has(targetId)) return;

        drawCards(room, targetId, 2);
        await broadcastHandUpdate(room, targetId);
        await broadcastToRoom(room.code, 'game:uno_caught', { caughtId: targetId, drawCount: 2 });
      } else {
        gs.unoCalled.add(playerId);
        await broadcastToRoom(room.code, 'game:uno_called', { playerId });
      }

      await saveRoom(room);
    });
  } catch (err) {
    if (err.message !== 'ROOM_LOCKED') throw err;
    return res.status(409).json({ code: 'ROOM_LOCKED' });
  }

  res.json({ ok: true });
});
