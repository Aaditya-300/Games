import { withCors } from '../_lib/cors.js';
import { requirePlayerId } from '../_lib/identity.js';
import { withRoomLock, saveRoom } from '../_lib/redis.js';
import { initSkGameState, getSkPublicState, pickWords, startRound } from '../_lib/skEngine.js';
import { isBotId } from '../_lib/utils/botUtils.js';
import { shuffle } from '../_lib/utils/shuffle.js';
import { systemMessage } from '../_lib/chatManager.js';
import { broadcastToRoom, sendToPlayer } from '../_lib/pusher.js';
import { broadcastRoundStarted } from '../_lib/skFlow.js';

export default withCors(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const playerId = requirePlayerId(req, res);
  if (!playerId) return;

  const { roomCode } = req.body || {};
  if (!roomCode) return res.status(400).json({ code: 'INVALID_REQUEST' });

  try {
    const result = await withRoomLock(roomCode, async (room) => {
      if (!room) return { error: { code: 'ROOM_NOT_FOUND' } };
      if (room.gameType !== 'sketch') return { error: { code: 'WRONG_GAME_TYPE' } };
      const player = room.players.get(playerId);
      if (!player?.isHost) return { error: { code: 'NOT_HOST', message: 'Only host can start' } };
      if (room.status !== 'waiting') return { error: { code: 'WRONG_STATUS', message: 'Game already started' } };

      const activePlayers = [...room.players.values()].filter(p => !p.isSpectator);
      const drawerQueue = shuffle(activePlayers.map(p => p.id));
      room.gameState = initSkGameState(room.code, drawerQueue);
      room.status = 'playing';

      const gs = room.gameState;
      const options = pickWords(gs, 3);
      gs.wordOptions = options;

      const msg = systemMessage(room, 'Sketch & Draw game started!');
      await broadcastToRoom(room.code, 'sk:started', { gameState: getSkPublicState(gs) });
      await broadcastToRoom(room.code, 'chat:message', { message: msg });

      if (isBotId(gs.currentDrawerId)) {
        const word = options[Math.floor(Math.random() * options.length)];
        startRound(room, word);
        await broadcastRoundStarted(room);
      } else {
        await sendToPlayer(gs.currentDrawerId, 'sk:word_options', { options });
      }

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
