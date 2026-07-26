import { verifyQstashSignature } from '../_lib/qstashReceiver.js';
import { withRoomLock, saveRoom } from '../_lib/redis.js';
import { drawCards } from '../_lib/cardEffects.js';
import { broadcastToRoom } from '../_lib/pusher.js';
import { broadcastHandUpdate } from '../_lib/gameFlow.js';

// QStash-only: nobody "owns" the UNO catch window the way a current player
// owns their turn timer — any other player might catch it, or nobody does —
// so there's no client-initiated path here, only the scheduled callback.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const valid = await verifyQstashSignature(req, JSON.stringify(req.body));
  if (!valid) return res.status(401).json({ code: 'INVALID_SIGNATURE' });

  const { roomCode, playerId, expectedTurnCount } = req.body || {};
  if (!roomCode || !playerId) return res.status(400).json({ code: 'INVALID_REQUEST' });

  await withRoomLock(roomCode, async (room) => {
    const gs = room?.gameState;
    if (!gs) return;
    if (gs.turnCount !== expectedTurnCount) return; // window already moved on
    const player = room.players.get(playerId);
    if (!player || player.hand.length !== 1 || gs.unoCalled.has(playerId)) return;

    drawCards(room, playerId, 2);
    await broadcastHandUpdate(room, playerId);
    await broadcastToRoom(room.code, 'game:uno_caught', { caughtId: playerId, drawCount: 2 });
    await saveRoom(room);
  });

  res.status(200).json({ ok: true });
}
