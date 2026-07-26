import { verifyQstashSignature } from '../_lib/qstashReceiver.js';
import { withRoomLock, saveRoom } from '../_lib/redis.js';
import { advanceToNextTurn } from '../_lib/gameFlow.js';

// QStash-only, same reasoning as uno-timeout.js: any player (not a fixed
// "owner") can challenge or let the window lapse.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const valid = await verifyQstashSignature(req, JSON.stringify(req.body));
  if (!valid) return res.status(401).json({ code: 'INVALID_SIGNATURE' });

  const { roomCode, expectedLastPlayerId } = req.body || {};
  if (!roomCode) return res.status(400).json({ code: 'INVALID_REQUEST' });

  await withRoomLock(roomCode, async (room) => {
    const gs = room?.gameState;
    if (!gs || !gs.wildDrawFourChallengeable) return; // already resolved by a challenge
    if (gs.lastPlayerId !== expectedLastPlayerId) return;

    gs.wildDrawFourChallengeable = false;
    // No challenge — pending draw is already set, next player will draw.
    await advanceToNextTurn(room);
    await saveRoom(room);
  });

  res.status(200).json({ ok: true });
}
