import { withCors } from '../_lib/cors.js';
import { requirePlayerId } from '../_lib/identity.js';
import { getRoom } from '../_lib/redis.js';
import { broadcastToRoom } from '../_lib/pusher.js';

export default withCors(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const playerId = requirePlayerId(req, res);
  if (!playerId) return;

  const { roomCode, stroke } = req.body || {};
  if (!roomCode || !stroke?.points?.length) return res.json({ ok: true });

  // No room-state mutation here (strokes are broadcast-only, not persisted),
  // so this skips the write lock other endpoints use — it's by far the
  // highest-frequency event in the app and a lock per mouse-stroke would be
  // needlessly expensive.
  const room = await getRoom(roomCode);
  const gs = room?.gameState;
  if (gs && gs.phase === 'drawing' && gs.currentDrawerId === playerId) {
    // Unlike Socket.io's socket.to(room) (all-but-sender), a server-triggered
    // Pusher event has no client to exclude — broadcast to everyone,
    // including the drawer, and let each client skip its own stroke via the
    // byId field (it already rendered the stroke locally as it drew).
    await broadcastToRoom(room.code, 'sk:draw_stroke', { stroke, byId: playerId });
  }

  res.json({ ok: true });
});
