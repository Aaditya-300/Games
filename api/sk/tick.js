import { verifyQstashSignature } from '../_lib/qstashReceiver.js';
import { withRoomLock, saveRoom } from '../_lib/redis.js';
import { endTurn } from '../_lib/skEngine.js';
import { advanceSkTurn } from '../_lib/skFlow.js';
import { broadcastToRoom } from '../_lib/pusher.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = JSON.stringify(req.body);
  const valid = await verifyQstashSignature(req, rawBody);
  if (!valid) return res.status(401).json({ code: 'INVALID_SIGNATURE' });

  const { roomCode, expectedWord, expectedPhase } = req.body || {};
  if (!roomCode) return res.status(400).json({ code: 'INVALID_REQUEST' });

  await withRoomLock(roomCode, async (room) => {
    const gs = room?.gameState;
    // Idempotency guard: a human (or bot resolution) may have already ended
    // this round via sk:guess/sk:end-turn — this stale callback is a no-op.
    if (!gs || gs.phase !== expectedPhase || gs.currentWord !== expectedWord) return;

    const turnResult = endTurn(room);
    await broadcastToRoom(room.code, 'sk:turn_ended', turnResult);
    await advanceSkTurn(room);
    await saveRoom(room);
  });

  res.status(200).json({ ok: true });
}
