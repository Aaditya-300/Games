import { withCors } from '../_lib/cors.js';
import { requirePlayerId } from '../_lib/identity.js';
import { withRoomLock, saveRoom } from '../_lib/redis.js';
import { beginWordPick } from '../_lib/skEngine.js';
import { broadcastRoundStarted } from '../_lib/skFlow.js';
import { isBotId } from '../_lib/utils/botUtils.js';
import { broadcastToRoom, sendToPlayer } from '../_lib/pusher.js';
import { getSkPublicState } from '../_lib/skEngine.js';

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

      if (room.hostId !== playerId) return { error: { code: 'NOT_HOST', message: 'Only host can advance round' } };
      if (gs.phase !== 'round_end') return { error: { code: 'WRONG_PHASE', message: 'Not in round end phase' } };

      gs.round++;
      gs.currentDrawerIndex = 0;
      beginWordPick(room);

      const drawerNickname = room.players.get(gs.currentDrawerId)?.nickname ?? 'Unknown';
      await broadcastToRoom(room.code, 'sk:next_drawer', {
        drawerId: gs.currentDrawerId,
        drawerNickname,
        gameState: getSkPublicState(gs),
      });

      if (isBotId(gs.currentDrawerId)) {
        await broadcastRoundStarted(room);
      } else {
        await sendToPlayer(gs.currentDrawerId, 'sk:word_options', { options: gs.wordOptions });
      }

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
