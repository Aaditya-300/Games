import { Redis } from '@upstash/redis';
import { ROOM_IDLE_TIMEOUT_MS } from './config.js';

export const redis = Redis.fromEnv();

const ROOM_IDLE_TIMEOUT_SEC = Math.ceil(ROOM_IDLE_TIMEOUT_MS / 1000);
const LOCK_TTL_SEC = 5;
const LOCK_RETRY_MS = 150;
const LOCK_MAX_ATTEMPTS = 20;

function serializeRoom(room) {
  const gs = room.gameState ? serializeGameState(room.gameState) : null;
  return JSON.stringify({
    ...room,
    players: Object.fromEntries(room.players),
    spectators: Object.fromEntries(room.spectators),
    gameState: gs,
  });
}

function serializeGameState(gs) {
  const out = { ...gs };
  if (out.unoCalled instanceof Set) out.unoCalled = [...out.unoCalled];
  if (out.revealedPositions instanceof Set) out.revealedPositions = [...out.revealedPositions];
  return out;
}

function deserializeGameState(gs) {
  if (!gs) return null;
  const out = { ...gs };
  if (Array.isArray(out.unoCalled)) out.unoCalled = new Set(out.unoCalled);
  if (Array.isArray(out.revealedPositions)) out.revealedPositions = new Set(out.revealedPositions);
  return out;
}

function deserializeRoom(raw) {
  return {
    ...raw,
    players: new Map(Object.entries(raw.players || {})),
    spectators: new Map(Object.entries(raw.spectators || {})),
    gameState: deserializeGameState(raw.gameState),
  };
}

export async function getRoom(code) {
  if (!code) return null;
  const raw = await redis.get(`room:${code}`);
  if (!raw) return null;
  // Upstash's client auto-parses JSON responses; guard against double-encoding.
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return deserializeRoom(parsed);
}

export async function saveRoom(room) {
  room.lastActivityAt = Date.now();
  await redis.set(`room:${room.code}`, serializeRoom(room), { ex: ROOM_IDLE_TIMEOUT_SEC });
}

export async function deleteRoom(code) {
  await redis.del(`room:${code}`);
}

export async function roomExists(code) {
  return (await redis.exists(`room:${code}`)) === 1;
}

// Guards a room mutation with a short-lived Redis lock so two concurrent
// requests for the same room (e.g. a bot's inline move racing a human's
// play) can't clobber each other's read-modify-write.
export async function withRoomLock(code, fn) {
  const lockKey = `room:${code}:lock`;
  let acquired = false;
  for (let attempt = 0; attempt < LOCK_MAX_ATTEMPTS; attempt++) {
    const ok = await redis.set(lockKey, '1', { nx: true, ex: LOCK_TTL_SEC });
    if (ok) { acquired = true; break; }
    await new Promise(r => setTimeout(r, LOCK_RETRY_MS));
  }
  if (!acquired) throw new Error('ROOM_LOCKED');

  try {
    const room = await getRoom(code);
    return await fn(room);
  } finally {
    await redis.del(lockKey);
  }
}
