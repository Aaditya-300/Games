import { withCors } from '../_lib/cors.js';
import { requirePlayerId } from '../_lib/identity.js';
import { withRoomLock, saveRoom } from '../_lib/redis.js';
import { recordGuess, resolveDueBotGuesses, endTurn, nonDrawerCount } from '../_lib/skEngine.js';
import { advanceSkTurn } from '../_lib/skFlow.js';
import { broadcastToRoom } from '../_lib/pusher.js';

export default withCors(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const playerId = requirePlayerId(req, res);
  if (!playerId) return;

  const { roomCode, text } = req.body || {};
  if (!roomCode) return res.status(400).json({ code: 'INVALID_REQUEST' });

  try {
    const result = await withRoomLock(roomCode, async (room) => {
      if (!room?.gameState) return { error: { code: 'NO_GAME' } };
      const gs = room.gameState;

      if (gs.phase !== 'drawing') return { error: { code: 'NO_ROUND', message: 'No active round' } };
      if (gs.currentDrawerId === playerId) return { ok: true };
      if (gs.correctGuessers.includes(playerId)) return { ok: true };

      const player = room.players.get(playerId);
      const nickname = player?.nickname ?? 'Unknown';
      const outcome = recordGuess(room, playerId, text);

      if (outcome.correct) {
        await broadcastToRoom(room.code, 'sk:player_guessed', { nickname });
      } else if (text?.trim()) {
        await broadcastToRoom(room.code, 'sk:public_guess', { nickname, text: text.trim() });
        if (outcome.newReveal) {
          await broadcastToRoom(room.code, 'sk:hint_update', { hint: outcome.hint });
        }
      }

      // A correct guess can push a bot's precomputed guess-by time into the
      // past relative to roundStartedAt without a request ever landing while
      // it was due — resolve any that are now overdue before checking the
      // all-guessed condition below.
      const dueBotGuesses = outcome.correct ? resolveDueBotGuesses(room) : [];
      for (const b of dueBotGuesses) await broadcastToRoom(room.code, 'sk:player_guessed', b);

      if (outcome.correct && gs.correctGuessers.length >= nonDrawerCount(room)) {
        const turnResult = endTurn(room);
        await broadcastToRoom(room.code, 'sk:turn_ended', turnResult);
        await advanceSkTurn(room);
      }

      await saveRoom(room);
      return outcome.correct ? { ok: true, correct: true, points: outcome.points, totalScore: outcome.totalScore } : { ok: true };
    });

    if (result.error) return res.status(400).json(result.error);
    res.json(result);
  } catch (err) {
    if (err.message === 'ROOM_LOCKED') return res.status(409).json({ code: 'ROOM_LOCKED' });
    throw err;
  }
});
