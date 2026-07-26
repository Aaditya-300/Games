import { pusher, broadcastToRoom } from '../_lib/pusher.js';
import { withRoomLock, saveRoom } from '../_lib/redis.js';
import { getRoomPublicView } from '../_lib/roomManager.js';
import { systemMessage } from '../_lib/chatManager.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  let webhook;
  try {
    webhook = pusher.validateWebhook({
      headers: req.headers,
      body: JSON.stringify(req.body),
    });
  } catch {
    return res.status(401).json({ message: 'Invalid webhook signature' });
  }

  for (const event of webhook.events) {
    if (event.name !== 'member_removed' && event.name !== 'member_added') continue;
    const match = /^presence-room-(.+)$/.exec(event.channel);
    if (!match) continue;
    const code = match[1];
    const playerId = event.user_id;
    const isConnected = event.name === 'member_added';

    try {
      await withRoomLock(code, async (room) => {
        if (!room) return;
        const player = room.players.get(playerId) || room.spectators.get(playerId);
        if (!player || player.isConnected === isConnected) return;

        player.isConnected = isConnected;
        await saveRoom(room);

        if (!isConnected) {
          const msg = systemMessage(room, `${player.nickname} disconnected`);
          await broadcastToRoom(code, 'chat:message', { message: msg });
        }
        await broadcastToRoom(code, 'room:updated', { room: getRoomPublicView(room) });
      });
    } catch {
      // Lock contention on a presence blip is not worth failing the webhook for.
    }
  }

  res.status(200).json({ ok: true });
}
