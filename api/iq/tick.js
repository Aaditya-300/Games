import { verifyQstashSignature } from '../_lib/qstashReceiver.js';
import { withRoomLock, saveRoom } from '../_lib/redis.js';
import { endQuestion, advanceQuestion, resolveDueBotAnswers, allAnswered } from '../_lib/iqEngine.js';
import { IQ_REVEAL_DURATION_MS, IQ_QUESTION_DURATION_MS } from '../_lib/config.js';
import { broadcastToRoom } from '../_lib/pusher.js';
import { scheduleCallback } from '../_lib/qstash.js';

// This endpoint is only ever hit by QStash (a scheduled, signed callback),
// never by a client directly — so it verifies the signature instead of a
// player identity header.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = JSON.stringify(req.body);
  const valid = await verifyQstashSignature(req, rawBody);
  if (!valid) return res.status(401).json({ code: 'INVALID_SIGNATURE' });

  const { roomCode, expectedPhase, expectedQuestionIndex } = req.body || {};
  if (!roomCode) return res.status(400).json({ code: 'INVALID_REQUEST' });

  await withRoomLock(roomCode, async (room) => {
    const gs = room?.gameState;
    // Idempotency guard: if a human action already resolved this window
    // (phase or question moved on), this stale callback is a no-op.
    if (!gs || gs.phase !== expectedPhase || gs.questionIndex !== expectedQuestionIndex) return;

    if (expectedPhase === 'question') {
      resolveDueBotAnswers(room);
      if (!allAnswered(room)) {
        // Force-resolve any remaining bots so a reveal always happens.
        for (const [, p] of room.players) {
          if (p.isBot && !p.isSpectator && !gs.answers[p.id]) {
            gs.answers[p.id] = { optionIndex: -1, answeredAt: Date.now() };
          }
        }
      }
      endQuestion(room);
      await saveRoom(room);
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
      return;
    }

    if (expectedPhase === 'reveal') {
      const gameOver = advanceQuestion(room);
      await saveRoom(room);
      if (gameOver) {
        await broadcastToRoom(room.code, 'iq:game_over', { scores: { ...gs.scores } });
      } else {
        await broadcastToRoom(room.code, 'iq:question', {
          questionIndex: gs.questionIndex,
          totalQuestions: gs.totalQuestions,
          text: gs.currentQuestion.text,
          options: gs.currentQuestion.options,
          questionEndsAt: gs.questionEndsAt,
        });
        await scheduleCallback('/api/iq/tick', {
          roomCode: room.code,
          expectedPhase: 'question',
          expectedQuestionIndex: gs.questionIndex,
        }, Math.ceil(IQ_QUESTION_DURATION_MS / 1000));
      }
    }
  });

  res.status(200).json({ ok: true });
}
