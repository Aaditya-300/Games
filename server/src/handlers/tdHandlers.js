import { getRooms, getRoomPublicView } from '../roomManager.js';
import { systemMessage } from '../chatManager.js';
import { TRUTHS, DARES } from '../tdCards.js';

function findSocketRoom(socketId) {
  for (const room of getRooms().values()) {
    if (room.players.has(socketId) || room.spectators.has(socketId)) return room;
  }
  return null;
}

function initTdGameState(roomCode, spinnerQueue) {
  return {
    roomCode,
    phase: 'spinning',
    spinnerQueue,
    currentSpinnerIndex: 0,
    currentSpinnerId: spinnerQueue[0],
    targetId: null,
    targetNickname: null,
    currentCard: null,
    usedTruthIndices: [],
    usedDareIndices: [],
    spunAt: null,
    turnCount: 0,
    startedAt: Date.now(),
  };
}

function pickCard(gameState, type) {
  const pool = type === 'truth' ? TRUTHS : DARES;
  const usedKey = type === 'truth' ? 'usedTruthIndices' : 'usedDareIndices';

  // Drain strategy: reset when all used
  if (gameState[usedKey].length >= pool.length) {
    gameState[usedKey] = [];
  }

  const usedSet = new Set(gameState[usedKey]);
  const available = pool.map((_, i) => i).filter(i => !usedSet.has(i));
  const idx = available[Math.floor(Math.random() * available.length)];
  gameState[usedKey].push(idx);

  return { type, text: pool[idx] };
}

function getTdPublicView(gs) {
  if (!gs) return null;
  return {
    roomCode: gs.roomCode,
    phase: gs.phase,
    spinnerQueue: gs.spinnerQueue,
    currentSpinnerIndex: gs.currentSpinnerIndex,
    currentSpinnerId: gs.currentSpinnerId,
    targetId: gs.targetId,
    targetNickname: gs.targetNickname,
    currentCard: gs.currentCard,
    spunAt: gs.spunAt,
    turnCount: gs.turnCount,
    startedAt: gs.startedAt,
  };
}

export function registerTdHandlers(io, socket) {
  socket.on('td:start', () => {
    const room = findSocketRoom(socket.id);
    if (!room) return;
    if (room.gameType !== 'truth_dare') return;

    const player = room.players.get(socket.id);
    if (!player?.isHost) return socket.emit('td:error', { code: 'NOT_HOST', message: 'Only host can start' });
    if (room.status !== 'waiting') return socket.emit('td:error', { code: 'WRONG_STATUS', message: 'Game already started' });

    const activePlayers = [...room.players.values()].filter(p => !p.isSpectator);

    const spinnerQueue = activePlayers
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map(p => p.id);

    room.gameState = initTdGameState(room.code, spinnerQueue);
    room.status = 'playing';
    room.lastActivityAt = Date.now();

    io.to(`room:${room.code}`).emit('td:started', { gameState: getTdPublicView(room.gameState) });

    const msg = systemMessage(room, 'Truth or Dare game started!');
    io.to(`room:${room.code}`).emit('chat:message', { message: msg });
  });

  socket.on('td:spin', () => {
    const room = findSocketRoom(socket.id);
    if (!room?.gameState) return;

    const gs = room.gameState;
    if (gs.phase !== 'spinning') return socket.emit('td:error', { code: 'WRONG_PHASE', message: 'Not in spinning phase' });
    if (gs.currentSpinnerId !== socket.id) return socket.emit('td:error', { code: 'NOT_YOUR_TURN', message: 'Not your turn to spin' });

    // Pick random target from active players
    const playerIds = [...room.players.keys()];
    const targetId = playerIds[Math.floor(Math.random() * playerIds.length)];
    const targetPlayer = room.players.get(targetId);

    // Pick card type 50/50
    const cardType = Math.random() < 0.5 ? 'truth' : 'dare';
    const card = pickCard(gs, cardType);

    gs.targetId = targetId;
    gs.targetNickname = targetPlayer?.nickname || 'Unknown';
    gs.currentCard = card;
    gs.phase = 'card_active';
    gs.spunAt = Date.now();
    room.lastActivityAt = Date.now();

    io.to(`room:${room.code}`).emit('td:spin_result', {
      targetId,
      targetNickname: gs.targetNickname,
      card,
      spinnerIndex: gs.currentSpinnerIndex,
      spunAt: gs.spunAt,
    });
  });

  socket.on('td:next_turn', () => {
    const room = findSocketRoom(socket.id);
    if (!room?.gameState) return;

    const gs = room.gameState;
    if (gs.phase !== 'card_active') return socket.emit('td:error', { code: 'WRONG_PHASE', message: 'No active card' });
    if (gs.currentSpinnerId !== socket.id) return socket.emit('td:error', { code: 'NOT_YOUR_TURN', message: 'Not your turn' });

    gs.currentSpinnerIndex = (gs.currentSpinnerIndex + 1) % gs.spinnerQueue.length;
    gs.currentSpinnerId = gs.spinnerQueue[gs.currentSpinnerIndex];
    gs.turnCount++;
    gs.phase = 'spinning';
    gs.targetId = null;
    gs.targetNickname = null;
    gs.currentCard = null;
    gs.spunAt = null;
    room.lastActivityAt = Date.now();

    io.to(`room:${room.code}`).emit('td:turn_advanced', { gameState: getTdPublicView(gs) });
  });

  socket.on('td:end', () => {
    const room = findSocketRoom(socket.id);
    if (!room) return;
    if (room.hostId !== socket.id) return socket.emit('td:error', { code: 'NOT_HOST', message: 'Only host can end the game' });

    if (room.gameState) {
      room.gameState.phase = 'ended';
    }
    room.status = 'waiting';
    room.lastActivityAt = Date.now();

    io.to(`room:${room.code}`).emit('td:ended', { reason: 'host' });

    const msg = systemMessage(room, 'Game ended by host.');
    io.to(`room:${room.code}`).emit('chat:message', { message: msg });
  });
}
