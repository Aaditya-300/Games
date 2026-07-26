import { withCors } from '../_lib/cors.js';
import { requirePlayerId } from '../_lib/identity.js';
import { withRoomLock, saveRoom } from '../_lib/redis.js';
import { playCard, computeRankings } from '../_lib/gameEngine.js';
import { getCurrentPlayerId } from '../_lib/turnManager.js';
import { getPublicGameView } from '../_lib/roomManager.js';
import { systemMessage } from '../_lib/chatManager.js';
import { broadcastToRoom, sendToPlayer } from '../_lib/pusher.js';
import { advanceToNextTurn, scheduleUnoWindow, scheduleChallengeWindow, broadcastHandUpdate, broadcastStateUpdate } from '../_lib/gameFlow.js';

export default withCors(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const playerId = requirePlayerId(req, res);
  if (!playerId) return;

  const { roomCode, cardId, chosenColor } = req.body || {};
  if (!roomCode || !cardId) return res.status(400).json({ code: 'INVALID_REQUEST' });

  try {
    const result = await withRoomLock(roomCode, async (room) => {
      if (!room?.gameState) return { error: { code: 'NO_GAME' } };

      const playResult = playCard(room, playerId, cardId, chosenColor);
      if (playResult.error) return { error: { code: playResult.error, message: playResult.error } };

      const { card, effectResult, won } = playResult;
      const gs = room.gameState;
      const player = room.players.get(playerId);

      await broadcastToRoom(room.code, 'game:card_played', {
        playerId, card, effect: effectResult.events,
      });
      await broadcastHandUpdate(room, playerId);
      await broadcastStateUpdate(room);

      if (won) {
        const rankings = computeRankings(room);
        await broadcastToRoom(room.code, 'game:winner', { winnerId: playerId, nickname: player.nickname, rankings });
        const msg = systemMessage(room, `${player.nickname} wins the game!`);
        await broadcastToRoom(room.code, 'chat:message', { message: msg });
        await saveRoom(room);
        return { ok: true };
      }

      // Special post-play phases wait for a follow-up call (choose-color, etc).
      if (['color_pick', 'swap_target', 'discard_color_pick', 'sabotage_target'].includes(gs.phase)) {
        await saveRoom(room);
        return { ok: true };
      }

      if (player.hand.length === 1 && !gs.unoCalled.has(playerId)) {
        await scheduleUnoWindow(room, playerId);
      }

      if (card.type === 'wild_draw4' && gs.wildDrawFourChallengeable) {
        await scheduleChallengeWindow(room);
        await saveRoom(room);
        return { ok: true };
      }

      if (card.type === 'peek') {
        const nextId = getCurrentPlayerId(gs);
        const nextPlayer = room.players.get(nextId);
        if (nextPlayer) {
          await sendToPlayer(playerId, 'game:peek_result', {
            targetId: nextId, targetNickname: nextPlayer.nickname, hand: nextPlayer.hand,
          });
        }
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
