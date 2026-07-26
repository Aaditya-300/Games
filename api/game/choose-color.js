import { withCors } from '../_lib/cors.js';
import { requirePlayerId } from '../_lib/identity.js';
import { withRoomLock, saveRoom } from '../_lib/redis.js';
import { resolveColorPick } from '../_lib/gameEngine.js';
import { resolveDrawUntilColor } from '../_lib/cardEffects.js';
import { getCurrentPlayerId, advanceTurn } from '../_lib/turnManager.js';
import { broadcastToRoom } from '../_lib/pusher.js';
import { advanceToNextTurn, broadcastHandUpdate, broadcastStateUpdate } from '../_lib/gameFlow.js';

export default withCors(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const playerId = requirePlayerId(req, res);
  if (!playerId) return;

  const { roomCode, color } = req.body || {};
  if (!roomCode || !color) return res.status(400).json({ code: 'INVALID_REQUEST' });

  try {
    const result = await withRoomLock(roomCode, async (room) => {
      if (!room?.gameState) return { error: { code: 'NO_GAME' } };
      const gs = room.gameState;
      if (gs.lastPlayerId !== playerId) return { ok: true };

      const colorResult = resolveColorPick(room, playerId, color);
      if (colorResult.error) return { error: { code: colorResult.error } };

      gs.currentColor = color;
      await broadcastToRoom(room.code, 'game:color_chosen', { color });
      await broadcastStateUpdate(room);

      if (gs.lastPlayedCard?.type === 'draw_until_color') {
        const nextId = getCurrentPlayerId(gs);
        const drawResult = resolveDrawUntilColor(room, nextId, color);
        const nextPlayer = room.players.get(nextId);

        if (drawResult.blocked) {
          await broadcastToRoom(room.code, 'game:shield_blocked', { playerId: nextId, blockedEffect: 'draw_until_color' });
        } else {
          await broadcastToRoom(room.code, 'game:draw_until_color', { playerId: nextId, drawnCount: drawResult.drawnCount, color });
        }
        if (nextPlayer) await broadcastHandUpdate(room, nextId);

        advanceTurn(gs);
        gs.phase = 'play';
        await broadcastStateUpdate(room);
      }

      if (gs.lastPlayedCard?.type === 'discard_color' && gs.phase === 'discard_color_pick') {
        await saveRoom(room);
        return { ok: true }; // waiting for choose-discard-color
      }

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
