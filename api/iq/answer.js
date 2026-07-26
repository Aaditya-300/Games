import { withCors } from '../_lib/cors.js';
import { requirePlayerId } from '../_lib/identity.js';
import { withRoomLock, saveRoom } from '../_lib/redis.js';
import { recordAnswer, allAnswered, resolveDueBotAnswers, endQuestion, getIqPublicView } from '../_lib/iqEngine.js';
import { IQ_REVEAL_DURATION_MS } from '../_lib/config.js';
import { broadcastToRoom } from '../_lib/pusher.js';
import { scheduleCallback } from '../_lib/qstash.js';

export default withCors(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const playerId = requirePlayerId(req, res);
  if (!playerId) return;

  const { roomCode, optionIndex } = req.body || {};
  if (!roomCode) return res.status(400).json({ code: 'INVALID_REQUEST' });

  try {
    const result = await withRoomLock(roomCode, async (room) => {
      if (!room?.gameState) return { error: { code: 'NO_GAME' } };
      const gs = room.gameState;

      if (gs.phase !== 'question') return { error: { code: 'WRONG_PHASE', message: 'No active question' } };
      const player = room.players.get(playerId);
      if (!player || player.isSpectator) return { error: { code: 'NOT_A_PLAYER' } };
      if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= gs.currentQuestion.options.length) {
        return { error: { code: 'INVALID_OPTION', message: 'Invalid option' } };
      }
      if (gs.answers[playerId]) return { ok: true, optionIndex: gs.answers[playerId].optionIndex };

      recordAnswer(room, playerId, optionIndex);
      resolveDueBotAnswers(room);

      await broadcastToRoom(room.code, 'iq:player_answered', {
        answeredCount: Object.keys(gs.answers).length,
        total: [...room.players.values()].filter(p => !p.isSpectator).length,
      });

      if (allAnswered(room)) {
        endQuestion(room);
        await broadcastToRoom(room.code, 'iq:reveal', {
          correctIndex: gs.lastResult.correctIndex,
          correctText: gs.lastResult.correctText,
          perPlayer: gs.lastResult.perPlayer,
          scores: { ...gs.scores },
        });
        await scheduleCallback('/api/iq/tick', {
          roomCode: room.code,
          expectedPhase: 'reveal',
          expectedQuestionIndex: gs.questionIndex,
        }, Math.ceil(IQ_REVEAL_DURATION_MS / 1000));
      }

      await saveRoom(room);
      return { ok: true, optionIndex };
    });

    if (result.error) return res.status(400).json(result.error);
    res.json(result);
  } catch (err) {
    if (err.message === 'ROOM_LOCKED') return res.status(409).json({ code: 'ROOM_LOCKED' });
    throw err;
  }
});
