import { withCors } from '../_lib/cors.js';
import { requirePlayerId } from '../_lib/identity.js';
import { getRoom, saveRoom, withRoomLock } from '../_lib/redis.js';
import { addPlayer, verifyPassword, getRoomPublicView, getPlayerGameView } from '../_lib/roomManager.js';
import { systemMessage } from '../_lib/chatManager.js';
import { broadcastToRoom } from '../_lib/pusher.js';

export default withCors(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const playerId = requirePlayerId(req, res);
  if (!playerId) return;

  const { nickname, roomCode, password } = req.body || {};
  if (!nickname?.trim()) return res.status(400).json({ code: 'INVALID_NICKNAME', message: 'Nickname required' });
  if (!roomCode) return res.status(400).json({ code: 'INVALID_CODE', message: 'Room code required' });

  const code = roomCode.toUpperCase();

  try {
    const result = await withRoomLock(code, async (room) => {
      if (!room) return { error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } };

      // Idempotent rejoin: a page reload reuses the same stable playerId,
      // so treat it as a refresh rather than creating a duplicate seat.
      const existing = room.players.get(playerId) || room.spectators.get(playerId);
      if (existing) {
        existing.isConnected = true;
        await saveRoom(room);
        return {
          room: getRoomPublicView(room),
          messages: room.chatHistory,
          gameState: room.gameState ? getPlayerGameView(room, playerId) : null,
        };
      }

      if (room.status === 'playing') return { error: { code: 'GAME_IN_PROGRESS', message: 'Game already started' } };
      if (room.players.size >= room.maxPlayers) return { error: { code: 'ROOM_FULL', message: 'Room is full' } };

      const nickExists = [...room.players.values(), ...room.spectators.values()]
        .some(p => p.nickname === nickname.trim());
      if (nickExists) return { error: { code: 'NICKNAME_TAKEN', message: 'Nickname already taken' } };

      const ok = await verifyPassword(room, password);
      if (!ok) return { error: { code: 'WRONG_PASSWORD', message: 'Wrong password' } };

      addPlayer(room, playerId, nickname.trim());
      const msg = systemMessage(room, `${nickname.trim()} joined the room`);
      await saveRoom(room);

      await broadcastToRoom(code, 'room:updated', { room: getRoomPublicView(room) });
      await broadcastToRoom(code, 'chat:message', { message: msg });

      return { room: getRoomPublicView(room), messages: room.chatHistory };
    });

    if (result.error) return res.status(400).json(result.error);
    res.json(result);
  } catch (err) {
    if (err.message === 'ROOM_LOCKED') return res.status(409).json({ code: 'ROOM_LOCKED', message: 'Room busy, try again' });
    throw err;
  }
});
