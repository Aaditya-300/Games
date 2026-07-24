import { getRooms, getRoomPublicView, getPlayerGameView, getPublicGameView } from '../roomManager.js';
import { systemMessage } from '../chatManager.js';
import { startGame, playCard, drawCard, pass, resolveColorPick, computeRankings } from '../gameEngine.js';
import { getCurrentPlayerId, advanceTurn } from '../turnManager.js';
import {
  resolveSwapHands, resolveDrawUntilColor, resolveDiscardColor,
  resolveSabotage, resolveChallenge, forceDraw, drawCards,
} from '../cardEffects.js';
import { createTimer } from '../utils/timer.js';
import { UNO_CATCH_WINDOW_MS, CHALLENGE_WINDOW_MS, PEEK_DURATION_MS } from '../config.js';
import { scheduleUnoBotTurn, emitTurnAndSchedule } from '../botManager.js';
import { isBotId } from '../utils/botUtils.js';

export function registerGameHandlers(io, socket) {
  socket.on('game:start', () => {
    const room = findSocketRoom(socket.id);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player?.isHost) return socket.emit('game:error', { code: 'NOT_HOST', message: 'Only host can start' });
    if (room.status !== 'waiting') return socket.emit('game:error', { code: 'WRONG_STATUS', message: 'Game already started' });

    const activePlayers = [...room.players.values()].filter(p => !p.isSpectator);

    startGame(room);

    // Send each player their private game view (skip bots — they have no socket)
    for (const p of activePlayers) {
      if (p.isBot) continue;
      const pSocket = io.sockets.sockets.get(p.id);
      pSocket?.emit('game:started', { gameState: getPlayerGameView(room, p.id) });
    }
    io.to(`room:${room.code}`).emit('game:state_update', { gameState: getPublicGameView(room.gameState) });

    const currentId = getCurrentPlayerId(room.gameState);
    io.to(`room:${room.code}`).emit('game:turn', {
      currentPlayerId: currentId,
      timeoutAt: room.gameState.turnStartedAt + room.gameState.turnDurationMs,
    });

    if (isBotId(currentId)) {
      scheduleUnoBotTurn(io, room, currentId);
    } else {
      startTurnTimer(io, room);
    }
    const msg = systemMessage(room, 'Game started!');
    io.to(`room:${room.code}`).emit('chat:message', { message: msg });
  });

  socket.on('game:play_card', ({ cardId, chosenColor } = {}) => {
    const room = findSocketRoom(socket.id);
    if (!room?.gameState) return;

    const result = playCard(room, socket.id, cardId, chosenColor);
    if (result.error) return socket.emit('game:error', { code: result.error, message: result.error });

    cancelTurnTimer(room);

    const { card, effectResult, won } = result;

    io.to(`room:${room.code}`).emit('game:card_played', {
      playerId: socket.id,
      card,
      effect: effectResult.events,
    });

    // Send private hand to player
    const player = room.players.get(socket.id);
    socket.emit('game:hand_update', { hand: player.hand });

    // Broadcast public state
    io.to(`room:${room.code}`).emit('game:state_update', { gameState: getPublicGameView(room.gameState) });

    if (won) {
      const rankings = computeRankings(room);
      io.to(`room:${room.code}`).emit('game:winner', {
        winnerId: socket.id,
        nickname: player.nickname,
        rankings,
      });
      const msg = systemMessage(room, `${player.nickname} wins the game!`);
      io.to(`room:${room.code}`).emit('chat:message', { message: msg });
      return;
    }

    // Handle special post-play phases
    const gs = room.gameState;

    if (gs.phase === 'color_pick') {
      return; // waiting for game:choose_color
    }
    if (gs.phase === 'swap_target') {
      return; // waiting for game:choose_swap_target
    }
    if (gs.phase === 'discard_color_pick') {
      return;
    }
    if (gs.phase === 'sabotage_target') {
      return;
    }

    // UNO check
    if (player.hand.length === 1 && !gs.unoCalled.has(socket.id)) {
      startUnoWindow(io, room, socket.id);
    }

    // Wild Draw 4 challenge window
    if (card.type === 'wild_draw4' && gs.wildDrawFourChallengeable) {
      startChallengeWindow(io, room, socket.id);
      return;
    }

    // Peek effect — send private hand to peeker
    if (card.type === 'peek') {
      const nextId = getCurrentPlayerId(gs);
      const nextPlayer = room.players.get(nextId);
      if (nextPlayer) {
        socket.emit('game:peek_result', {
          targetId: nextId,
          targetNickname: nextPlayer.nickname,
          hand: nextPlayer.hand,
        });
      }
    }

    emitTurn(io, room);
    startTurnTimer(io, room);
  });

  socket.on('game:choose_color', ({ color } = {}) => {
    const room = findSocketRoom(socket.id);
    if (!room?.gameState) return;
    const gs = room.gameState;
    if (gs.lastPlayerId !== socket.id) return;

    const result = resolveColorPick(room, socket.id, color);
    if (result.error) return socket.emit('game:error', { code: result.error });

    gs.currentColor = color;
    io.to(`room:${room.code}`).emit('game:color_chosen', { color });
    io.to(`room:${room.code}`).emit('game:state_update', { gameState: getPublicGameView(gs) });

    // If this was a draw_until_color card
    if (gs.lastPlayedCard?.type === 'draw_until_color') {
      const nextId = getCurrentPlayerId(gs);
      const drawResult = resolveDrawUntilColor(room, nextId, color);
      if (drawResult.blocked) {
        const nextPlayer = room.players.get(nextId);
        io.to(`room:${room.code}`).emit('game:shield_blocked', { playerId: nextId, blockedEffect: 'draw_until_color' });
        nextPlayer && io.sockets.sockets.get(nextId)?.emit('game:hand_update', { hand: nextPlayer.hand });
      } else {
        const nextPlayer = room.players.get(nextId);
        io.to(`room:${room.code}`).emit('game:draw_until_color', {
          playerId: nextId,
          drawnCount: drawResult.drawnCount,
          color,
        });
        nextPlayer && io.sockets.sockets.get(nextId)?.emit('game:hand_update', { hand: nextPlayer.hand });
      }
      advanceTurn(gs);
      gs.phase = 'play';
      io.to(`room:${room.code}`).emit('game:state_update', { gameState: getPublicGameView(gs) });
    }

    // If this was a discard_color card
    if (gs.lastPlayedCard?.type === 'discard_color' && gs.phase === 'discard_color_pick') {
      return; // waiting for game:choose_discard_color
    }

    emitTurn(io, room);
    startTurnTimer(io, room);
  });

  socket.on('game:choose_discard_color', ({ color } = {}) => {
    const room = findSocketRoom(socket.id);
    if (!room?.gameState) return;
    const gs = room.gameState;
    if (gs.lastPlayerId !== socket.id) return;
    if (!['red', 'blue', 'green', 'yellow'].includes(color)) return;

    gs.currentColor = color;
    const nextId = getCurrentPlayerId(gs);

    // advance past the actor to get target
    const len = gs.activePlayers.length;
    const targetIdx = ((gs.currentTurnIndex + gs.direction) % len + len) % len;
    const targetId = gs.activePlayers[targetIdx];

    const discardResult = resolveDiscardColor(room, targetId, color);
    const targetPlayer = room.players.get(targetId);

    if (discardResult.blocked) {
      io.to(`room:${room.code}`).emit('game:shield_blocked', { playerId: targetId, blockedEffect: 'discard_color' });
    } else {
      io.to(`room:${room.code}`).emit('game:discard_color', {
        playerId: targetId,
        color,
        discardedCount: discardResult.discardedCount,
      });
    }

    targetPlayer && io.sockets.sockets.get(targetId)?.emit('game:hand_update', { hand: targetPlayer.hand });

    // Check if target won (hand emptied by discard)
    if (targetPlayer && targetPlayer.hand.length === 0) {
      gs.winner = targetId;
      gs.phase = 'finished';
      room.status = 'finished';
      const rankings = computeRankings(room);
      io.to(`room:${room.code}`).emit('game:winner', {
        winnerId: targetId,
        nickname: targetPlayer.nickname,
        rankings,
      });
      return;
    }

    advanceTurn(gs);
    gs.phase = 'play';
    io.to(`room:${room.code}`).emit('game:state_update', { gameState: getPublicGameView(gs) });
    emitTurn(io, room);
    startTurnTimer(io, room);
  });

  socket.on('game:choose_swap_target', ({ targetId } = {}) => {
    const room = findSocketRoom(socket.id);
    if (!room?.gameState) return;
    const gs = room.gameState;
    if (gs.lastPlayerId !== socket.id) return;
    if (gs.phase !== 'swap_target') return;

    // Also need color pick for swap_hands
    // If no chosenColor yet, prompt for color first
    if (!gs.currentColor || gs.currentColor === 'wild') {
      gs.pendingSwapTarget = targetId;
      gs.phase = 'color_pick';
      return;
    }

    const swapResult = resolveSwapHands(room, socket.id, targetId);
    const actor = room.players.get(socket.id);
    const target = room.players.get(targetId);

    if (swapResult.blocked) {
      io.to(`room:${room.code}`).emit('game:shield_blocked', { playerId: targetId, blockedEffect: 'swap_hands' });
    } else {
      io.to(`room:${room.code}`).emit('game:swap_hands', { fromId: socket.id, toId: targetId });
      actor && socket.emit('game:hand_update', { hand: actor.hand });
      target && io.sockets.sockets.get(targetId)?.emit('game:hand_update', { hand: target.hand });
    }

    advanceTurn(gs);
    gs.phase = 'play';
    gs.turnCount++;
    io.to(`room:${room.code}`).emit('game:state_update', { gameState: getPublicGameView(gs) });
    emitTurn(io, room);
    startTurnTimer(io, room);
  });

  socket.on('game:choose_sabotage_target', ({ targetId } = {}) => {
    const room = findSocketRoom(socket.id);
    if (!room?.gameState) return;
    const gs = room.gameState;
    if (gs.lastPlayerId !== socket.id) return;
    if (gs.phase !== 'sabotage_target') return;
    if (gs.sabotageDepth > 0) return; // no nested sabotages

    gs.sabotageDepth = 1;
    const sabResult = resolveSabotage(room, targetId);
    const targetPlayer = room.players.get(targetId);

    if (sabResult.blocked) {
      io.to(`room:${room.code}`).emit('game:shield_blocked', { playerId: targetId, blockedEffect: 'sabotage' });
    } else if (sabResult.card) {
      io.to(`room:${room.code}`).emit('game:card_played', {
        playerId: targetId,
        card: sabResult.card,
        effect: [{ type: 'sabotaged', byId: socket.id }],
      });
      targetPlayer && io.sockets.sockets.get(targetId)?.emit('game:hand_update', { hand: targetPlayer.hand });
      io.to(`room:${room.code}`).emit('game:state_update', { gameState: getPublicGameView(gs) });
    }

    gs.sabotageDepth = 0;
    advanceTurn(gs);
    gs.phase = 'play';
    gs.turnCount++;
    io.to(`room:${room.code}`).emit('game:state_update', { gameState: getPublicGameView(gs) });
    emitTurn(io, room);
    startTurnTimer(io, room);
  });

  socket.on('game:draw_card', () => {
    const room = findSocketRoom(socket.id);
    if (!room?.gameState) return;

    const result = drawCard(room, socket.id);
    if (result.error) return socket.emit('game:error', { code: result.error });

    cancelTurnTimer(room);
    const player = room.players.get(socket.id);

    socket.emit('game:hand_update', { hand: player.hand });
    io.to(`room:${room.code}`).emit('game:cards_drawn', { playerId: socket.id, count: result.drawn.length });
    io.to(`room:${room.code}`).emit('game:state_update', { gameState: getPublicGameView(room.gameState) });

    if (result.forced) {
      // Turn already advanced inside drawCard
      emitTurn(io, room);
      startTurnTimer(io, room);
    }
    // else: phase = 'drawn', player can play or pass — no new turn timer yet
  });

  socket.on('game:pass', () => {
    const room = findSocketRoom(socket.id);
    if (!room?.gameState) return;

    const result = pass(room, socket.id);
    if (result.error) return socket.emit('game:error', { code: result.error });

    io.to(`room:${room.code}`).emit('game:state_update', { gameState: getPublicGameView(room.gameState) });
    emitTurn(io, room);
    startTurnTimer(io, room);
  });

  socket.on('game:call_uno', ({ targetId } = {}) => {
    const room = findSocketRoom(socket.id);
    if (!room?.gameState) return;
    const gs = room.gameState;

    if (targetId && targetId !== socket.id) {
      // Catching another player
      const target = room.players.get(targetId);
      if (!target) return;
      if (target.hand.length !== 1) return;
      if (gs.unoCalled.has(targetId)) return; // already called

      // Give 2 penalty cards
      drawCards(room, targetId, 2);
      const tSocket = io.sockets.sockets.get(targetId);
      tSocket?.emit('game:hand_update', { hand: target.hand });
      io.to(`room:${room.code}`).emit('game:uno_caught', { caughtId: targetId, drawCount: 2 });
    } else {
      // Self-calling UNO
      gs.unoCalled.add(socket.id);
      io.to(`room:${room.code}`).emit('game:uno_called', { playerId: socket.id });
    }
  });

  socket.on('game:challenge_draw4', () => {
    const room = findSocketRoom(socket.id);
    if (!room?.gameState) return;
    const gs = room.gameState;

    if (!gs.wildDrawFourChallengeable) return socket.emit('game:error', { code: 'NOT_CHALLENGEABLE' });

    cancelTurnTimer(room);
    if (room.challengeTimer) { room.challengeTimer.cancel(); room.challengeTimer = null; }

    const challengedId = gs.lastPlayerId;
    const result = resolveChallenge(room, socket.id, challengedId);

    const penalizedSocket = io.sockets.sockets.get(result.penalizedId);
    const penalizedPlayer = room.players.get(result.penalizedId);
    penalizedSocket?.emit('game:hand_update', { hand: penalizedPlayer.hand });

    io.to(`room:${room.code}`).emit('game:challenge_result', {
      challengerId: socket.id,
      challengedId,
      success: result.success,
      drawn: result.drawn,
      penalizedId: result.penalizedId,
    });

    gs.wildDrawFourChallengeable = false;
    io.to(`room:${room.code}`).emit('game:state_update', { gameState: getPublicGameView(gs) });
    emitTurn(io, room);
    startTurnTimer(io, room);
  });
}

// ─── helpers ────────────────────────────────────────────────────────────────

function findSocketRoom(socketId) {
  for (const room of getRooms().values()) {
    if (room.players.has(socketId) || room.spectators.has(socketId)) return room;
  }
  return null;
}

function emitTurn(io, room) {
  const gs = room.gameState;
  if (!gs || gs.phase === 'finished') return;
  io.to(`room:${room.code}`).emit('game:turn', {
    currentPlayerId: getCurrentPlayerId(gs),
    timeoutAt: gs.turnStartedAt + gs.turnDurationMs,
  });
}

function startTurnTimer(io, room) {
  // If next player is a bot, hand off to bot scheduler instead of a human turn timer
  const gs = room.gameState;
  if (gs && isBotId(getCurrentPlayerId(gs))) {
    scheduleUnoBotTurn(io, room, getCurrentPlayerId(gs));
    return;
  }
  cancelTurnTimer(room);
  if (!gs || gs.phase === 'finished') return;

  const currentId = getCurrentPlayerId(gs);
  room.currentTimer = createTimer(() => {
    if (!room.gameState || room.gameState.phase === 'finished') return;
    if (getCurrentPlayerId(room.gameState) !== currentId) return;

    // Auto-draw
    const player = room.players.get(currentId);
    if (!player) return;

    const drawn = forceDraw(room, currentId);
    const pSocket = io.sockets.sockets.get(currentId);
    pSocket?.emit('game:hand_update', { hand: player.hand });

    io.to(`room:${room.code}`).emit('game:turn_timeout', { playerId: currentId });
    io.to(`room:${room.code}`).emit('game:cards_drawn', { playerId: currentId, count: drawn.count });

    advanceTurn(room.gameState);
    room.gameState.phase = 'play';
    io.to(`room:${room.code}`).emit('game:state_update', { gameState: getPublicGameView(room.gameState) });
    emitTurn(io, room);
    startTurnTimer(io, room);
  }, gs.turnDurationMs);
}

function cancelTurnTimer(room) {
  if (room.currentTimer) {
    room.currentTimer.cancel();
    room.currentTimer = null;
  }
}

function startUnoWindow(io, room, playerId) {
  if (room.unoTimer) { room.unoTimer.cancel(); room.unoTimer = null; }
  room.unoTimer = createTimer(() => {
    const gs = room.gameState;
    if (!gs) return;
    const player = room.players.get(playerId);
    if (!player || player.hand.length !== 1 || gs.unoCalled.has(playerId)) return;
    // Auto-penalize
    drawCards(room, playerId, 2);
    const pSocket = io.sockets.sockets.get(playerId);
    pSocket?.emit('game:hand_update', { hand: player.hand });
    io.to(`room:${room.code}`).emit('game:uno_caught', { caughtId: playerId, drawCount: 2 });
  }, UNO_CATCH_WINDOW_MS);
}

function startChallengeWindow(io, room, playerId) {
  if (room.challengeTimer) { room.challengeTimer.cancel(); room.challengeTimer = null; }
  room.challengeTimer = createTimer(() => {
    const gs = room.gameState;
    if (!gs || !gs.wildDrawFourChallengeable) return;
    gs.wildDrawFourChallengeable = false;
    // No challenge — pending draw is already set, next player will draw
    emitTurn(io, room);
    startTurnTimer(io, room);
  }, CHALLENGE_WINDOW_MS);
}
