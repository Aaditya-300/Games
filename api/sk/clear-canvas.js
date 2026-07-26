import { withCors } from '../_lib/cors.js';
import { requirePlayerId } from '../_lib/identity.js';
import { getRoom } from '../_lib/redis.js';
import { broadcastToRoom } from '../_lib/pusher.js';

export default withCors(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const playerId = requirePlayerId(req, res);
  if (!playerId) return;

  const { roomCode } = req.body || {};
  if (!roomCode) return res.json({ ok: true });

  const room = await getRoom(roomCode);
  if (room?.gameState?.currentDrawerId === playerId) {
    await broadcastToRoom(room.code, 'sk:canvas_cleared', {});
  }

  res.json({ ok: true });
});
