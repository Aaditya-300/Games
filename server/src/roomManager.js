import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { generateRoomCode } from './utils/roomCode.js';
import { MAX_PLAYERS, CHAT_HISTORY_LIMIT, ROOM_IDLE_TIMEOUT_MS, ROOM_CLEANUP_INTERVAL_MS } from './config.js';

const rooms = new Map();

export function getRooms() {
  return rooms;
}

export function getRoom(code) {
  return rooms.get(code) || null;
}

export async function createRoom(nickname, password, gameType = 'uno') {
  const code = generateRoomCode(rooms);
  const passwordHash = password ? await bcrypt.hash(password, 10) : null;

  const room = {
    code,
    passwordHash,
    hostId: null,
    status: 'waiting',
    gameType,
    players: new Map(),
    spectators: new Map(),
    gameState: null,
    chatHistory: [],
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    maxPlayers: MAX_PLAYERS,
    currentTimer: null,
    unoTimer: null,
    challengeTimer: null,
  };

  rooms.set(code, room);
  return room;
}

export function addPlayer(room, socketId, nickname, isSpectator = false) {
  const seatIndex = isSpectator ? -1 : [...room.players.values()].length;
  const player = {
    id: socketId,
    nickname,
    roomCode: room.code,
    isHost: false,
    isSpectator,
    hand: [],
    hasCalledUno: false,
    isConnected: true,
    reconnectToken: uuidv4(),
    shieldActive: false,
    seatIndex,
  };

  if (isSpectator) {
    room.spectators.set(socketId, player);
  } else {
    room.players.set(socketId, player);
    if (room.players.size === 1) {
      player.isHost = true;
      room.hostId = socketId;
    }
  }

  room.lastActivityAt = Date.now();
  return player;
}

export async function verifyPassword(room, password) {
  if (!room.passwordHash) return true;
  if (!password) return false;
  return bcrypt.compare(password, room.passwordHash);
}

export function removePlayer(room, socketId) {
  const player = room.players.get(socketId) || room.spectators.get(socketId);
  if (!player) return null;

  if (player.isSpectator) {
    room.spectators.delete(socketId);
  } else {
    room.players.delete(socketId);
    if (room.hostId === socketId) {
      const next = [...room.players.values()].find(p => !p.isSpectator);
      if (next) {
        next.isHost = true;
        room.hostId = next.id;
      } else {
        room.hostId = null;
      }
    }
  }

  return player;
}

export function getRoomPublicView(room) {
  return {
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    hasPassword: !!room.passwordHash,
    maxPlayers: room.maxPlayers,
    gameType: room.gameType || 'uno',
    players: [...room.players.values()].map(p => ({
      id: p.id,
      nickname: p.nickname,
      seatIndex: p.seatIndex,
      isHost: p.isHost,
      isBot: !!p.isBot,
      isConnected: p.isConnected,
      cardCount: p.hand.length,
      shieldActive: p.shieldActive,
    })),
    spectators: [...room.spectators.values()].map(p => ({
      id: p.id,
      nickname: p.nickname,
      isConnected: p.isConnected,
    })),
  };
}

export function getPlayerGameView(room, playerId) {
  const gs = room.gameState;
  if (!gs) return null;
  const player = room.players.get(playerId);

  return {
    ...getPublicGameView(gs),
    hand: player ? player.hand : [],
  };
}

export function getPublicGameView(gs) {
  if (!gs) return null;
  return {
    roomCode: gs.roomCode,
    currentColor: gs.currentColor,
    currentValue: gs.currentValue,
    direction: gs.direction,
    currentPlayerId: gs.activePlayers[gs.currentTurnIndex],
    activePlayers: gs.activePlayers,
    pendingDraw: gs.pendingDraw,
    pendingDrawType: gs.pendingDrawType,
    phase: gs.phase,
    topCard: gs.discardPile[gs.discardPile.length - 1] || null,
    drawPileCount: gs.drawPile.length,
    discardPileCount: gs.discardPile.length,
    lastPlayedCard: gs.lastPlayedCard,
    lastPlayerId: gs.lastPlayerId,
    wildDrawFourChallengeable: gs.wildDrawFourChallengeable,
    turnStartedAt: gs.turnStartedAt,
    turnDurationMs: gs.turnDurationMs,
    winner: gs.winner,
    turnCount: gs.turnCount,
    unoCalled: [...gs.unoCalled],
  };
}

// Periodic cleanup of idle rooms
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.lastActivityAt > ROOM_IDLE_TIMEOUT_MS) {
      if (room.currentTimer) clearTimeout(room.currentTimer);
      rooms.delete(code);
    }
  }
}, ROOM_CLEANUP_INTERVAL_MS);
