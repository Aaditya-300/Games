import { verifyQstashSignature } from '../_lib/qstashReceiver.js';
import { withRoomLock, saveRoom } from '../_lib/redis.js';
import { forceDraw } from '../_lib/cardEffects.js';
import { getCurrentPlayerId, advanceTurn } from '../_lib/turnManager.js';
import { broadcastToRoom } from '../_lib/pusher.js';
import { advanceToNextTurn, broadcastHandUpdate, broadcastStateUpdate } from '../_lib/gameFlow.js';
import { withCors } from '../_lib/cors.js';
import { requirePlayerId } from '../_lib/identity.js';

// Hit two ways, matching the design in gameFlow.js's advanceToNextTurn:
// (1) the current player's own client, when its local countdown hits zero
//     (the common case — the tab is open and can self-report);
// (2) QStash's scheduled callback, as a safety net if that tab is closed.
// Both converge on the same idempotent body below.
async function resolveTimeout(roomCode, expectedPlayerId, expectedTurnStartedAt) {
  return withRoomLock(roomCode, async (room) => {
    const gs = room?.gameState;
    if (!gs || gs.phase === 'finished') return;
    if (getCurrentPlayerId(gs) !== expectedPlayerId) return;
    if (gs.turnStartedAt !== expectedTurnStartedAt) return;

    const player = room.players.get(expectedPlayerId);
    if (!player) return;

    const drawn = forceDraw(room, expectedPlayerId);
    await broadcastHandUpdate(room, expectedPlayerId);
    await broadcastToRoom(room.code, 'game:turn_timeout', { playerId: expectedPlayerId });
    await broadcastToRoom(room.code, 'game:cards_drawn', { playerId: expectedPlayerId, count: drawn.count });

    advanceTurn(gs);
    gs.phase = 'play';
    await broadcastStateUpdate(room);
    await advanceToNextTurn(room);
    await saveRoom(room);
  });
}

async function handler(req, res) {
  const { roomCode, expectedPlayerId, expectedTurnStartedAt } = req.body || {};
  if (!roomCode || !expectedPlayerId) return res.status(400).json({ code: 'INVALID_REQUEST' });

  if (req.headers['upstash-signature']) {
    const valid = await verifyQstashSignature(req, JSON.stringify(req.body));
    if (!valid) return res.status(401).json({ code: 'INVALID_SIGNATURE' });
  } else {
    // Client-initiated call — require a real player, and only the timed-out
    // player's own tab reports its own timeout (mirrors the old code, where
    // the timer lived server-side but only ever acted on the current player).
    const playerId = requirePlayerId(req, res);
    if (!playerId) return;
    if (playerId !== expectedPlayerId) return res.status(403).json({ code: 'NOT_YOUR_TURN' });
  }

  await resolveTimeout(roomCode, expectedPlayerId, expectedTurnStartedAt);
  res.status(200).json({ ok: true });
}

export default withCors(handler);
