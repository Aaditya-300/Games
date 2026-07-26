import { withCors } from '../_lib/cors.js';
import { requirePlayerId } from '../_lib/identity.js';
import { withRoomLock, saveRoom } from '../_lib/redis.js';
import { resolveChallenge } from '../_lib/cardEffects.js';
import { broadcastToRoom } from '../_lib/pusher.js';
import { advanceToNextTurn, broadcastHandUpdate, broadcastStateUpdate } from '../_lib/gameFlow.js';

export default withCors(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const playerId = requirePlayerId(req, res);
  if (!playerId) return;

  const { roomCode } = req.body || {};
  if (!roomCode) return res.status(400).json({ code: 'INVALID_REQUEST' });

  try {
    const result = await withRoomLock(roomCode, async (room) => {
      if (!room?.gameState) return { error: { code: 'NO_GAME' } };
      const gs = room.gameState;

      if (!gs.wildDrawFourChallengeable) return { error: { code: 'NOT_CHALLENGEABLE' } };

      const challengedId = gs.lastPlayerId;
      const challengeResult = resolveChallenge(room, playerId, challengedId);

      await broadcastHandUpdate(room, challengeResult.penalizedId);
      await broadcastToRoom(room.code, 'game:challenge_result', {
        challengerId: playerId,
        challengedId,
        success: challengeResult.success,
        drawn: challengeResult.drawn,
        penalizedId: challengeResult.penalizedId,
      });

      gs.wildDrawFourChallengeable = false;
      await broadcastStateUpdate(room);
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
