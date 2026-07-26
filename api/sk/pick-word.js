import { withCors } from '../_lib/cors.js';
import { requirePlayerId } from '../_lib/identity.js';
import { withRoomLock, saveRoom } from '../_lib/redis.js';
import { startRound, buildHint } from '../_lib/skEngine.js';
import { broadcastRoundStarted } from '../_lib/skFlow.js';
import { broadcastToRoom } from '../_lib/pusher.js';

export default withCors(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const playerId = requirePlayerId(req, res);
  if (!playerId) return;

  const { roomCode, word } = req.body || {};
  if (!roomCode) return res.status(400).json({ code: 'INVALID_REQUEST' });

  try {
    const result = await withRoomLock(roomCode, async (room) => {
      if (!room?.gameState) return { error: { code: 'NO_GAME' } };
      const gs = room.gameState;

      if (gs.phase !== 'word_pick') return { error: { code: 'WRONG_PHASE', message: 'Not in word pick phase' } };
      if (gs.currentDrawerId !== playerId) return { error: { code: 'NOT_YOUR_TURN', message: 'Not your turn to draw' } };
      if (!gs.wordOptions?.includes(word)) return { error: { code: 'INVALID_WORD', message: 'Invalid word choice' } };

      startRound(room, word);
      await saveRoom(room);

      await broadcastRoundStarted(room);
      // word_confirmed is a direct-to-caller notice, not a room broadcast —
      // synthesized client-side from this response instead.
      return { ok: true, word };
    });

    if (result.error) return res.status(400).json(result.error);
    res.json(result);
  } catch (err) {
    if (err.message === 'ROOM_LOCKED') return res.status(409).json({ code: 'ROOM_LOCKED' });
    throw err;
  }
});
