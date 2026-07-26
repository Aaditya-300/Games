import { withCors } from '../_lib/cors.js';
import { requirePlayerId } from '../_lib/identity.js';
import { withRoomLock, saveRoom } from '../_lib/redis.js';
import { resolveDiscardColor } from '../_lib/cardEffects.js';
import { computeRankings } from '../_lib/gameEngine.js';
import { getCurrentPlayerId, advanceTurn } from '../_lib/turnManager.js';
import { broadcastToRoom } from '../_lib/pusher.js';
import { advanceToNextTurn, broadcastHandUpdate, broadcastStateUpdate } from '../_lib/gameFlow.js';

const VALID_COLORS = ['red', 'blue', 'green', 'yellow'];

export default withCors(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const playerId = requirePlayerId(req, res);
  if (!playerId) return;

  const { roomCode, color } = req.body || {};
  if (!roomCode || !VALID_COLORS.includes(color)) return res.status(400).json({ code: 'INVALID_REQUEST' });

  try {
    const result = await withRoomLock(roomCode, async (room) => {
      if (!room?.gameState) return { error: { code: 'NO_GAME' } };
      const gs = room.gameState;
      if (gs.lastPlayerId !== playerId) return { ok: true };

      gs.currentColor = color;
      const len = gs.activePlayers.length;
      const targetIdx = ((gs.currentTurnIndex + gs.direction) % len + len) % len;
      const targetId = gs.activePlayers[targetIdx];

      const discardResult = resolveDiscardColor(room, targetId, color);
      const targetPlayer = room.players.get(targetId);

      if (discardResult.blocked) {
        await broadcastToRoom(room.code, 'game:shield_blocked', { playerId: targetId, blockedEffect: 'discard_color' });
      } else {
        await broadcastToRoom(room.code, 'game:discard_color', { playerId: targetId, color, discardedCount: discardResult.discardedCount });
      }
      await broadcastHandUpdate(room, targetId);

      if (targetPlayer && targetPlayer.hand.length === 0) {
        gs.winner = targetId;
        gs.phase = 'finished';
        room.status = 'finished';
        const rankings = computeRankings(room);
        await broadcastToRoom(room.code, 'game:winner', { winnerId: targetId, nickname: targetPlayer.nickname, rankings });
        await saveRoom(room);
        return { ok: true };
      }

      advanceTurn(gs);
      gs.phase = 'play';
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
