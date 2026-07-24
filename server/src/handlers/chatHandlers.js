import { getRooms } from '../roomManager.js';
import { addMessage } from '../chatManager.js';

export function registerChatHandlers(io, socket) {
  socket.on('chat:send', ({ text } = {}) => {
    if (!text?.trim()) return;
    const room = findSocketRoom(socket.id);
    if (!room) return;

    const player = room.players.get(socket.id) || room.spectators.get(socket.id);
    if (!player) return;

    const trimmed = text.trim().slice(0, 300);
    const msg = addMessage(room, socket.id, player.nickname, trimmed);
    io.to(`room:${room.code}`).emit('chat:message', { message: msg });
    room.lastActivityAt = Date.now();
  });
}

function findSocketRoom(socketId) {
  for (const room of getRooms().values()) {
    if (room.players.has(socketId) || room.spectators.has(socketId)) return room;
  }
  return null;
}
