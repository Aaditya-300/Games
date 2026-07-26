import { pusher, roomChannel, playerChannel } from '../_lib/pusher.js';
import { requirePlayerId } from '../_lib/identity.js';
import { getRoom } from '../_lib/redis.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const playerId = requirePlayerId(req, res);
  if (!playerId) return;

  const { socket_id: socketId, channel_name: channelName } = req.body || {};
  if (!socketId || !channelName) {
    return res.status(400).json({ message: 'socket_id and channel_name required' });
  }

  if (channelName.startsWith('private-player-')) {
    if (channelName !== playerChannel(playerId)) {
      return res.status(403).json({ message: 'Cannot subscribe to another player\'s private channel' });
    }
    const authResponse = pusher.authorizeChannel(socketId, channelName);
    return res.json(authResponse);
  }

  if (channelName.startsWith('presence-room-')) {
    const code = channelName.replace('presence-room-', '');
    const room = await getRoom(code);
    const isMember = room && (room.players.has(playerId) || room.spectators.has(playerId));
    if (!isMember) {
      return res.status(403).json({ message: 'Not a member of this room' });
    }
    const player = room.players.get(playerId) || room.spectators.get(playerId);
    const authResponse = pusher.authorizeChannel(socketId, channelName, {
      user_id: playerId,
      user_info: { nickname: player.nickname },
    });
    return res.json(authResponse);
  }

  return res.status(403).json({ message: 'Unknown channel type' });
}
