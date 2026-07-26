import bcrypt from 'bcryptjs';
import { generateRoomCode } from './utils/roomCode.js';
import { roomExists } from './redis.js';
import { MAX_PLAYERS, MAX_PLAYERS_UNO } from './config.js';

export async function createRoom(password, gameType = 'uno') {
  let code;
  do {
    code = generateRoomCode();
  } while (await roomExists(code));

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
    maxPlayers: gameType === 'uno' ? MAX_PLAYERS_UNO : MAX_PLAYERS,
  };

  return room;
}

export function addPlayer(room, playerId, nickname, isSpectator = false) {
  const seatIndex = isSpectator ? -1 : [...room.players.values()].length;
  const player = {
    id: playerId,
    nickname,
    roomCode: room.code,
    isHost: false,
    isSpectator,
    hand: [],
    hasCalledUno: false,
    isConnected: true,
    shieldActive: false,
    seatIndex,
  };

  if (isSpectator) {
    room.spectators.set(playerId, player);
  } else {
    room.players.set(playerId, player);
    if (room.players.size === 1) {
      player.isHost = true;
      room.hostId = playerId;
    }
  }

  return player;
}

export async function verifyPassword(room, password) {
  if (!room.passwordHash) return true;
  if (!password) return false;
  return bcrypt.compare(password, room.passwordHash);
}

export function removePlayer(room, playerId) {
  const player = room.players.get(playerId) || room.spectators.get(playerId);
  if (!player) return null;

  if (player.isSpectator) {
    room.spectators.delete(playerId);
  } else {
    room.players.delete(playerId);
    if (room.hostId === playerId) {
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
