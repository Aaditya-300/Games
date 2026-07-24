import { RECONNECT_TIMEOUT_MS } from './config.js';

const tokens = new Map();
// token → { socketId, roomCode, nickname, timer }

export function registerToken(token, socketId, roomCode, nickname) {
  const existing = tokens.get(token);
  if (existing?.timer) clearTimeout(existing.timer);

  const timer = setTimeout(() => tokens.delete(token), RECONNECT_TIMEOUT_MS);
  tokens.set(token, { socketId, roomCode, nickname, timer });
}

export function lookupToken(token) {
  return tokens.get(token) || null;
}

export function updateTokenSocket(token, newSocketId) {
  const entry = tokens.get(token);
  if (entry) entry.socketId = newSocketId;
}

export function removeToken(token) {
  const entry = tokens.get(token);
  if (entry?.timer) clearTimeout(entry.timer);
  tokens.delete(token);
}
