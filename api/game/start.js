import { withCors } from '../_lib/cors.js';
import { requirePlayerId } from '../_lib/identity.js';
import { withRoomLock, saveRoom } from '../_lib/redis.js';
import { startGame } from '../_lib/gameEngine.js';
import { getPlayerGameView, getPublicGameView } from '../_lib/roomManager.js';
import { systemMessage } from '../_lib/chatManager.js';
import { broadcastToRoom, sendToPlayer } from '../_lib/pusher.js';
import { advanceToNextTurn } from '../_lib/gameFlow.js';

export default withCors(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const playerId = requirePlayerId(req, res);
  if (!playerId) return;

  const { roomCode } = req.body || {};
  if (!roomCode) return res.status(400).json({ code: 'INVALID_REQUEST' });

  try {
    const result = await withRoomLock(roomCode, async (room) => {
      if (!room) return { error: { code: 'ROOM_NOT_FOUND' } };
      const player = room.players.get(playerId);
      if (!player?.isHost) return { error: { code: 'NOT_HOST', message: 'Only host can start' } };
      if (room.status === 'playing') return { error: { code: 'WRONG_STATUS', message: 'Game already started' } };

      const activePlayers = [...room.players.values()].filter(p => !p.isSpectator);
      startGame(room);

      for (const p of activePlayers) {
        if (p.isBot) continue;
        await sendToPlayer(p.id, 'game:started', { gameState: getPlayerGameView(room, p.id) });
      }
      await broadcastToRoom(room.code, 'game:state_update', { gameState: getPublicGameView(room.gameState) });

      await advanceToNextTurn(room);

      const msg = systemMessage(room, 'Game started!');
      await broadcastToRoom(room.code, 'chat:message', { message: msg });

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
