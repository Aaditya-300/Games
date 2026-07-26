import { withCors } from '../_lib/cors.js';
import { requirePlayerId } from '../_lib/identity.js';
import { withRoomLock, saveRoom } from '../_lib/redis.js';
import { getTdPublicView } from '../_lib/tdEngine.js';
import { broadcastToRoom } from '../_lib/pusher.js';

export default withCors(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const playerId = requirePlayerId(req, res);
  if (!playerId) return;

  const { roomCode } = req.body || {};
  if (!roomCode) return res.status(400).json({ code: 'INVALID_REQUEST' });

  try {
    const result = await withRoomLock(roomCode, async (room) => {
      if (!room?.gameState) return { error: { code: 'NO_GAME' } };
      const gs = room.gameState;

      if (gs.phase !== 'card_active') return { error: { code: 'WRONG_PHASE', message: 'No active card' } };
      if (gs.currentSpinnerId !== playerId) return { error: { code: 'NOT_YOUR_TURN', message: 'Not your turn' } };

      gs.currentSpinnerIndex = (gs.currentSpinnerIndex + 1) % gs.spinnerQueue.length;
      gs.currentSpinnerId = gs.spinnerQueue[gs.currentSpinnerIndex];
      gs.turnCount++;
      gs.phase = 'spinning';
      gs.targetId = null;
      gs.targetNickname = null;
      gs.currentCard = null;
      gs.spunAt = null;
      await saveRoom(room);

      await broadcastToRoom(room.code, 'td:turn_advanced', { gameState: getTdPublicView(gs) });
      return { ok: true };
    });

    if (result.error) return res.status(400).json(result.error);
    res.json(result);
  } catch (err) {
    if (err.message === 'ROOM_LOCKED') return res.status(409).json({ code: 'ROOM_LOCKED' });
    throw err;
  }
});
