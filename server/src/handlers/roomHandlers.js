import {
  createRoom, addPlayer, verifyPassword, removePlayer,
  getRoom, getRoomPublicView, getRooms,
} from '../roomManager.js';
import { registerToken, lookupToken, updateTokenSocket } from '../reconnect.js';
import { systemMessage } from '../chatManager.js';
import { getPlayerGameView, getPublicGameView } from '../roomManager.js';
import { getCurrentPlayerId } from '../turnManager.js';
import { MAX_PLAYERS } from '../config.js';
import { addBot, removeBot, getBotIds } from '../botManager.js';

export function registerRoomHandlers(io, socket) {
  socket.on('room:create', async ({ nickname, password, gameType } = {}) => {
    if (!nickname?.trim()) return socket.emit('room:error', { code: 'INVALID_NICKNAME', message: 'Nickname required' });

    const room = await createRoom(nickname.trim(), password || null, gameType || 'uno');
    const player = addPlayer(room, socket.id, nickname.trim());
    registerToken(player.reconnectToken, socket.id, room.code, nickname.trim());

    socket.join(`room:${room.code}`);
    socket.emit('room:created', { room: getRoomPublicView(room), reconnectToken: player.reconnectToken });
    socket.emit('chat:history', { messages: room.chatHistory });
    systemMessage(room, `${nickname.trim()} created the room`);
  });

  socket.on('room:join', async ({ nickname, roomCode, password } = {}) => {
    if (!nickname?.trim()) return socket.emit('room:error', { code: 'INVALID_NICKNAME', message: 'Nickname required' });
    if (!roomCode) return socket.emit('room:error', { code: 'INVALID_CODE', message: 'Room code required' });

    const room = getRoom(roomCode.toUpperCase());
    if (!room) return socket.emit('room:error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
    if (room.status === 'playing') return socket.emit('room:error', { code: 'GAME_IN_PROGRESS', message: 'Game already started' });
    if (room.players.size >= room.maxPlayers) return socket.emit('room:error', { code: 'ROOM_FULL', message: 'Room is full' });

    const nickExists = [...room.players.values(), ...room.spectators.values()]
      .some(p => p.nickname === nickname.trim());
    if (nickExists) return socket.emit('room:error', { code: 'NICKNAME_TAKEN', message: 'Nickname already taken' });

    const ok = await verifyPassword(room, password);
    if (!ok) return socket.emit('room:error', { code: 'WRONG_PASSWORD', message: 'Wrong password' });

    const player = addPlayer(room, socket.id, nickname.trim());
    registerToken(player.reconnectToken, socket.id, room.code, nickname.trim());

    socket.join(`room:${room.code}`);
    socket.emit('room:joined', { room: getRoomPublicView(room), reconnectToken: player.reconnectToken });
    socket.emit('chat:history', { messages: room.chatHistory });

    const msg = systemMessage(room, `${nickname.trim()} joined the room`);
    io.to(`room:${room.code}`).emit('room:updated', { room: getRoomPublicView(room) });
    io.to(`room:${room.code}`).emit('chat:message', { message: msg });
  });

  socket.on('room:spectate', async ({ nickname, roomCode, password } = {}) => {
    if (!nickname?.trim()) return socket.emit('room:error', { code: 'INVALID_NICKNAME', message: 'Nickname required' });

    const room = getRoom(roomCode?.toUpperCase());
    if (!room) return socket.emit('room:error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });

    const nickExists = [...room.players.values(), ...room.spectators.values()]
      .some(p => p.nickname === nickname.trim());
    if (nickExists) return socket.emit('room:error', { code: 'NICKNAME_TAKEN', message: 'Nickname taken' });

    const ok = await verifyPassword(room, password);
    if (!ok) return socket.emit('room:error', { code: 'WRONG_PASSWORD', message: 'Wrong password' });

    const player = addPlayer(room, socket.id, nickname.trim(), true);
    registerToken(player.reconnectToken, socket.id, room.code, nickname.trim());

    socket.join(`room:${room.code}`);
    socket.emit('room:joined', { room: getRoomPublicView(room), reconnectToken: player.reconnectToken, isSpectator: true });
    socket.emit('chat:history', { messages: room.chatHistory });

    if (room.gameState) {
      socket.emit('game:state_update', { gameState: getPublicGameView(room.gameState) });
    }

    const msg = systemMessage(room, `${nickname.trim()} is spectating`);
    io.to(`room:${room.code}`).emit('room:updated', { room: getRoomPublicView(room) });
    io.to(`room:${room.code}`).emit('chat:message', { message: msg });
  });

  socket.on('room:leave', () => {
    handleLeave(io, socket);
  });

  socket.on('room:kick', ({ targetId } = {}) => {
    const room = findSocketRoom(socket.id);
    if (!room) return;
    const kicker = room.players.get(socket.id);
    if (!kicker?.isHost) return socket.emit('room:error', { code: 'NOT_HOST', message: 'Only host can kick' });

    const targetSocket = io.sockets.sockets.get(targetId);
    removePlayer(room, targetId);
    targetSocket?.emit('room:kicked', { reason: 'Kicked by host' });
    targetSocket?.leave(`room:${room.code}`);

    const msg = systemMessage(room, `A player was kicked`);
    io.to(`room:${room.code}`).emit('room:updated', { room: getRoomPublicView(room) });
    io.to(`room:${room.code}`).emit('chat:message', { message: msg });
  });

  socket.on('room:add_bot', () => {
    const room = findSocketRoom(socket.id);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player?.isHost) return socket.emit('room:error', { code: 'NOT_HOST', message: 'Only host can add bots' });
    if (room.status !== 'waiting') return socket.emit('room:error', { code: 'WRONG_STATUS', message: 'Cannot add bots mid-game' });
    if (room.players.size >= room.maxPlayers) return socket.emit('room:error', { code: 'ROOM_FULL', message: 'Room is full' });

    const bot = addBot(room);
    const msg = systemMessage(room, `${bot.nickname} (Bot) joined the room`);
    io.to(`room:${room.code}`).emit('room:updated', { room: getRoomPublicView(room) });
    io.to(`room:${room.code}`).emit('chat:message', { message: msg });
  });

  socket.on('room:remove_bot', ({ botId } = {}) => {
    const room = findSocketRoom(socket.id);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player?.isHost) return socket.emit('room:error', { code: 'NOT_HOST', message: 'Only host can remove bots' });
    if (!room.players.get(botId)?.isBot) return;

    const bot = room.players.get(botId);
    removeBot(room, botId);
    const msg = systemMessage(room, `${bot.nickname} (Bot) was removed`);
    io.to(`room:${room.code}`).emit('room:updated', { room: getRoomPublicView(room) });
    io.to(`room:${room.code}`).emit('chat:message', { message: msg });
  });

  socket.on('room:reconnect', ({ reconnectToken, roomCode } = {}) => {
    const entry = lookupToken(reconnectToken);
    if (!entry || entry.roomCode !== roomCode?.toUpperCase()) {
      return socket.emit('room:error', { code: 'INVALID_TOKEN', message: 'Invalid reconnect token' });
    }

    const room = getRoom(roomCode.toUpperCase());
    if (!room) return socket.emit('room:error', { code: 'ROOM_NOT_FOUND', message: 'Room no longer exists' });

    const player = [...room.players.values(), ...room.spectators.values()]
      .find(p => p.reconnectToken === reconnectToken);
    if (!player) return socket.emit('room:error', { code: 'PLAYER_NOT_FOUND', message: 'Player not found' });

    // Update socket id
    const oldId = player.id;
    room.players.delete(oldId);
    room.spectators.delete(oldId);
    player.id = socket.id;
    player.isConnected = true;

    if (player.isSpectator) {
      room.spectators.set(socket.id, player);
    } else {
      room.players.set(socket.id, player);
      if (room.hostId === oldId) room.hostId = socket.id;
    }

    // Update activePlayers array in game state
    if (room.gameState) {
      const idx = room.gameState.activePlayers.indexOf(oldId);
      if (idx !== -1) room.gameState.activePlayers[idx] = socket.id;
    }

    updateTokenSocket(reconnectToken, socket.id);
    socket.join(`room:${room.code}`);

    socket.emit('room:reconnected', {
      room: getRoomPublicView(room),
      reconnectToken,
      gameState: room.gameState ? getPlayerGameView(room, socket.id) : null,
    });
    socket.emit('chat:history', { messages: room.chatHistory.slice(-50) });

    const msg = systemMessage(room, `${player.nickname} reconnected`);
    io.to(`room:${room.code}`).emit('room:updated', { room: getRoomPublicView(room) });
    io.to(`room:${room.code}`).emit('chat:message', { message: msg });
  });

  socket.on('disconnect', () => {
    handleLeave(io, socket, true);
  });
}

function handleLeave(io, socket, isDisconnect = false) {
  const room = findSocketRoom(socket.id);
  if (!room) return;

  const player = room.players.get(socket.id) || room.spectators.get(socket.id);
  if (!player) return;

  if (isDisconnect) {
    player.isConnected = false;
    // Mark disconnected but keep in room for reconnect window
    if (room.gameState && room.gameState.activePlayers.includes(socket.id)) {
      // If it's their turn, auto-advance after a short delay
      if (getCurrentPlayerId(room.gameState) === socket.id) {
        setTimeout(() => {
          if (!player.isConnected) {
            // handled by turn timeout logic in gameHandlers
          }
        }, 5000);
      }
    }
    io.to(`room:${room.code}`).emit('room:updated', { room: getRoomPublicView(room) });
    return;
  }

  removePlayer(room, socket.id);
  socket.leave(`room:${room.code}`);

  const msg = systemMessage(room, `${player.nickname} left the room`);
  io.to(`room:${room.code}`).emit('room:updated', { room: getRoomPublicView(room) });
  io.to(`room:${room.code}`).emit('chat:message', { message: msg });

  if (room.players.size === 0 && room.spectators.size === 0) {
    if (room.currentTimer) clearTimeout(room.currentTimer);
    getRooms().delete(room.code);
  }
}

function findSocketRoom(socketId) {
  for (const room of getRooms().values()) {
    if (room.players.has(socketId) || room.spectators.has(socketId)) return room;
  }
  return null;
}
