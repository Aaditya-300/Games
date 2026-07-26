import { withCors } from '../_lib/cors.js';
import { requirePlayerId } from '../_lib/identity.js';
import { withRoomLock, saveRoom } from '../_lib/redis.js';
import { initTdGameState, getTdPublicView } from '../_lib/tdEngine.js';
import { systemMessage } from '../_lib/chatManager.js';
import { broadcastToRoom } from '../_lib/pusher.js';

export default withCors(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const playerId = requirePlayerId(req, res);
  if (!playerId) return;

  const { roomCode } = req.body || {};
  if (!roomCode) return res.status(400).json({ code: 'INVALID_REQUEST' });

  try {
    const result = await withRoomLock(roomCode, async (room) => {
      if (!room) return { error: { code: 'ROOM_NOT_FOUND' } };
      if (room.gameType !== 'truth_dare') return { error: { code: 'WRONG_GAME_TYPE' } };
      const player = room.players.get(playerId);
      if (!player?.isHost) return { error: { code: 'NOT_HOST', message: 'Only host can start' } };
      if (room.status !== 'waiting') return { error: { code: 'WRONG_STATUS', message: 'Game already started' } };

      const activePlayers = [...room.players.values()].filter(p => !p.isSpectator);
      const spinnerQueue = activePlayers.sort((a, b) => a.seatIndex - b.seatIndex).map(p => p.id);

      room.gameState = initTdGameState(room.code, spinnerQueue);
      room.status = 'playing';
      const msg = systemMessage(room, 'Truth or Dare game started!');
      await saveRoom(room);

      await broadcastToRoom(room.code, 'td:started', { gameState: getTdPublicView(room.gameState) });
      await broadcastToRoom(room.code, 'chat:message', { message: msg });
      return { ok: true };
    });

    if (result.error) return res.status(400).json(result.error);
    res.json(result);
  } catch (err) {
    if (err.message === 'ROOM_LOCKED') return res.status(409).json({ code: 'ROOM_LOCKED' });
    throw err;
  }
});
