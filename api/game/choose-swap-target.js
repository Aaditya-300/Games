import { withCors } from '../_lib/cors.js';
import { requirePlayerId } from '../_lib/identity.js';
import { withRoomLock, saveRoom } from '../_lib/redis.js';
import { resolveSwapHands } from '../_lib/cardEffects.js';
import { advanceTurn } from '../_lib/turnManager.js';
import { broadcastToRoom } from '../_lib/pusher.js';
import { advanceToNextTurn, broadcastHandUpdate, broadcastStateUpdate } from '../_lib/gameFlow.js';

export default withCors(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const playerId = requirePlayerId(req, res);
  if (!playerId) return;

  const { roomCode, targetId } = req.body || {};
  if (!roomCode || !targetId) return res.status(400).json({ code: 'INVALID_REQUEST' });

  try {
    const result = await withRoomLock(roomCode, async (room) => {
      if (!room?.gameState) return { error: { code: 'NO_GAME' } };
      const gs = room.gameState;
      if (gs.lastPlayerId !== playerId) return { ok: true };
      if (gs.phase !== 'swap_target') return { ok: true };

      // Also need color pick for swap_hands — if no chosenColor yet, prompt for it first.
      if (!gs.currentColor || gs.currentColor === 'wild') {
        gs.pendingSwapTarget = targetId;
        gs.phase = 'color_pick';
        await saveRoom(room);
        return { ok: true };
      }

      const swapResult = resolveSwapHands(room, playerId, targetId);
      const actor = room.players.get(playerId);
      const target = room.players.get(targetId);

      if (swapResult.blocked) {
        await broadcastToRoom(room.code, 'game:shield_blocked', { playerId: targetId, blockedEffect: 'swap_hands' });
      } else {
        await broadcastToRoom(room.code, 'game:swap_hands', { fromId: playerId, toId: targetId });
        if (actor) await broadcastHandUpdate(room, playerId);
        if (target) await broadcastHandUpdate(room, targetId);
      }

      advanceTurn(gs);
      gs.phase = 'play';
      gs.turnCount++;
      await broadcastStateUpdate(room);
      await advanceToNextTurn(room);
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
