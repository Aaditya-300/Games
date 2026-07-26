import { withCors } from '../_lib/cors.js';
import { requirePlayerId } from '../_lib/identity.js';
import { withRoomLock, saveRoom } from '../_lib/redis.js';
import { pickQuestions, initIqGameState, getIqPublicView, activePlayerIds, beginQuestion } from '../_lib/iqEngine.js';
import { IQ_TOTAL_QUESTIONS, IQ_QUESTION_DURATION_MS } from '../_lib/config.js';
import { systemMessage } from '../_lib/chatManager.js';
import { broadcastToRoom } from '../_lib/pusher.js';
import { scheduleCallback } from '../_lib/qstash.js';

export default withCors(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const playerId = requirePlayerId(req, res);
  if (!playerId) return;

  const { roomCode } = req.body || {};
  if (!roomCode) return res.status(400).json({ code: 'INVALID_REQUEST' });

  try {
    const result = await withRoomLock(roomCode, async (room) => {
      if (!room) return { error: { code: 'ROOM_NOT_FOUND' } };
      if (room.gameType !== 'iq') return { error: { code: 'WRONG_GAME_TYPE' } };
      const player = room.players.get(playerId);
      if (!player?.isHost) return { error: { code: 'NOT_HOST', message: 'Only host can start' } };
      if (room.status !== 'waiting') return { error: { code: 'WRONG_STATUS', message: 'Game already started' } };

      const playerIds = activePlayerIds(room);
      const questions = pickQuestions(IQ_TOTAL_QUESTIONS);
      room.gameState = initIqGameState(room.code, playerIds, questions);
      room.status = 'playing';

      beginQuestion(room);
      const msg = systemMessage(room, 'IQ Test started!');
      await saveRoom(room);

      await broadcastToRoom(room.code, 'iq:started', { gameState: getIqPublicView(room.gameState) });
      await broadcastToRoom(room.code, 'iq:question', {
        questionIndex: room.gameState.questionIndex,
        totalQuestions: room.gameState.totalQuestions,
        text: room.gameState.currentQuestion.text,
        options: room.gameState.currentQuestion.options,
        questionEndsAt: room.gameState.questionEndsAt,
      });
      await broadcastToRoom(room.code, 'chat:message', { message: msg });

      await scheduleCallback('/api/iq/tick', {
        roomCode: room.code,
        expectedPhase: 'question',
        expectedQuestionIndex: room.gameState.questionIndex,
      }, Math.ceil(IQ_QUESTION_DURATION_MS / 1000));

      return { ok: true };
    });

    if (result.error) return res.status(400).json(result.error);
    res.json(result);
  } catch (err) {
    if (err.message === 'ROOM_LOCKED') return res.status(409).json({ code: 'ROOM_LOCKED' });
    throw err;
  }
});
