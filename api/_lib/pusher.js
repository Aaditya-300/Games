import Pusher from 'pusher';

export const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

export function roomChannel(code) {
  return `presence-room-${code}`;
}

export function playerChannel(playerId) {
  return `private-player-${playerId}`;
}

export async function broadcastToRoom(code, event, data) {
  await pusher.trigger(roomChannel(code), event, data);
}

export async function sendToPlayer(playerId, event, data) {
  await pusher.trigger(playerChannel(playerId), event, data);
}
