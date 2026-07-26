import { withCors } from '../_lib/cors.js';
import { requirePlayerId } from '../_lib/identity.js';
import { withRoomLock, saveRoom } from '../_lib/redis.js';
import { pickCard } from '../_lib/tdEngine.js';
import { broadcastToRoom } from '../_lib/pusher.js';

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

      if (gs.phase !== 'spinning') return { error: { code: 'WRONG_PHASE', message: 'Not in spinning phase' } };
      if (gs.currentSpinnerId !== playerId) return { error: { code: 'NOT_YOUR_TURN', message: 'Not your turn to spin' } };

      const playerIds = [...room.players.keys()];
      const targetId = playerIds[Math.floor(Math.random() * playerIds.length)];
      const targetPlayer = room.players.get(targetId);

      const cardType = Math.random() < 0.5 ? 'truth' : 'dare';
      const card = pickCard(gs, cardType);

      gs.targetId = targetId;
      gs.targetNickname = targetPlayer?.nickname || 'Unknown';
      gs.currentCard = card;
      gs.phase = 'card_active';
      gs.spunAt = Date.now();
      await saveRoom(room);

      await broadcastToRoom(room.code, 'td:spin_result', {
        targetId,
        targetNickname: gs.targetNickname,
        card,
        spinnerIndex: gs.currentSpinnerIndex,
        spunAt: gs.spunAt,
      });
      return { ok: true };
    });

    if (result.error) return res.status(400).json(result.error);
    res.json(result);
  } catch (err) {
    if (err.message === 'ROOM_LOCKED') return res.status(409).json({ code: 'ROOM_LOCKED' });
    throw err;
  }
});
