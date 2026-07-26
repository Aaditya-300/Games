import { withCors } from '../_lib/cors.js';
import { requirePlayerId } from '../_lib/identity.js';
import { createRoom, addPlayer, getRoomPublicView } from '../_lib/roomManager.js';
import { systemMessage } from '../_lib/chatManager.js';
import { saveRoom } from '../_lib/redis.js';

export default withCors(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const playerId = requirePlayerId(req, res);
  if (!playerId) return;

  const { nickname, password, gameType } = req.body || {};
  if (!nickname?.trim()) {
    return res.status(400).json({ code: 'INVALID_NICKNAME', message: 'Nickname required' });
  }

  const room = await createRoom(password || null, gameType || 'uno');
  addPlayer(room, playerId, nickname.trim());
  systemMessage(room, `${nickname.trim()} created the room`);
  await saveRoom(room);

  res.json({ room: getRoomPublicView(room), messages: room.chatHistory });
});
