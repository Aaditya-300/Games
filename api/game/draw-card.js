import { withCors } from '../_lib/cors.js';
import { requirePlayerId } from '../_lib/identity.js';
import { withRoomLock, saveRoom } from '../_lib/redis.js';
import { drawCard } from '../_lib/gameEngine.js';
import { broadcastToRoom } from '../_lib/pusher.js';
import { advanceToNextTurn, broadcastHandUpdate, broadcastStateUpdate } from '../_lib/gameFlow.js';

export default withCors(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const playerId = requirePlayerId(req, res);
  if (!playerId) return;

  const { roomCode } = req.body || {};
  if (!roomCode) return res.status(400).json({ code: 'INVALID_REQUEST' });

  try {
    const result = await withRoomLock(roomCode, async (room) => {
      if (!room?.gameState) return { error: { code: 'NO_GAME' } };

      const drawResult = drawCard(room, playerId);
      if (drawResult.error) return { error: { code: drawResult.error } };

      await broadcastHandUpdate(room, playerId);
      await broadcastToRoom(room.code, 'game:cards_drawn', { playerId, count: drawResult.drawn.length });
      await broadcastStateUpdate(room);

      if (drawResult.forced) {
        // Turn already advanced inside drawCard.
        await advanceToNextTurn(room);
      }
      // else: phase = 'drawn', player can play or pass — no new turn timer yet.

      await saveRoom(room);
      return { ok: true };
    });

    if (result.error) return res.status(400).json(result.error);
    res.json(result);
  } catch (err) {
    if (err.message === 'ROOM_LOCKED') return res.status(409).json({ code: 'ROOM_LOCKED' });
    throw err;
  }
});
