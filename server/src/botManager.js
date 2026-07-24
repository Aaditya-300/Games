import { v4 as uuidv4 } from 'uuid';
import { BOT_NAMES, isBotId } from './utils/botUtils.js';
import { isPlayable } from './validators.js';
import { getCurrentPlayerId, advanceTurn } from './turnManager.js';
import { playCard, drawCard, pass, computeRankings } from './gameEngine.js';
import { resolveSwapHands, resolveDiscardColor, resolveSabotage } from './cardEffects.js';
import { getPublicGameView } from './roomManager.js';

const BOT_THINK_MS = 1200;

// ─── Room-level bot management ───────────────────────────────────────────────

export function addBot(room) {
  const usedNames = new Set([...room.players.values()].map(p => p.nickname));
  const name = BOT_NAMES.find(n => !usedNames.has(n)) ?? `Bot${room.players.size + 1}`;
  const botId = `bot_${uuidv4()}`;
  const seatIndex = [...room.players.values()].length;

  const bot = {
    id: botId,
    nickname: name,
    roomCode: room.code,
    isHost: false,
    isSpectator: false,
    isBot: true,
    hand: [],
    hasCalledUno: false,
    isConnected: true,
    reconnectToken: null,
    shieldActive: false,
    seatIndex,
  };

  room.players.set(botId, bot);
  if (room.players.size === 1) {
    bot.isHost = true;
    room.hostId = botId;
  }
  return bot;
}

export function removeBot(room, botId) {
  room.players.delete(botId);
  if (room.hostId === botId) {
    const next = [...room.players.values()].find(p => !p.isSpectator);
    if (next) { next.isHost = true; room.hostId = next.id; }
    else room.hostId = null;
  }
}

export function getBotIds(room) {
  return [...room.players.values()].filter(p => p.isBot).map(p => p.id);
}

// ─── UNO bot AI ───────────────────────────────────────────────────────────────

export function scheduleUnoBotTurn(io, room, botId) {
  setTimeout(() => {
    if (!room.gameState) return;
    const gs = room.gameState;
    if (gs.phase === 'finished') return;
    if (getCurrentPlayerId(gs) !== botId) return;
    runUnoBotTurn(io, room, botId);
  }, BOT_THINK_MS);
}

function runUnoBotTurn(io, room, botId) {
  const gs = room.gameState;
  if (!gs || gs.phase === 'finished') return;
  if (getCurrentPlayerId(gs) !== botId) return;

  const bot = room.players.get(botId);
  if (!bot) return;

  if (gs.pendingDraw > 0) {
    const result = drawCard(room, botId);
    if (result.error) return;
    io.to(`room:${room.code}`).emit('game:cards_drawn', { playerId: botId, count: result.drawn.length });
    io.to(`room:${room.code}`).emit('game:state_update', { gameState: getPublicGameView(gs) });
    emitTurnAndSchedule(io, room);
    return;
  }

  const playable = bot.hand.filter(c => isPlayable(c, gs));

  if (playable.length === 0) {
    const drawResult = drawCard(room, botId);
    if (drawResult.error) return;
    io.to(`room:${room.code}`).emit('game:cards_drawn', { playerId: botId, count: 1 });
    io.to(`room:${room.code}`).emit('game:state_update', { gameState: getPublicGameView(gs) });

    const drawn = drawResult.drawn[0];
    if (drawn && isPlayable(drawn, gs)) {
      playBotCard(io, room, botId, drawn);
    } else {
      pass(room, botId);
      io.to(`room:${room.code}`).emit('game:state_update', { gameState: getPublicGameView(gs) });
      emitTurnAndSchedule(io, room);
    }
    return;
  }

  // Prefer non-wild cards; among those, prefer action cards to dump them
  const nonWild = playable.filter(c => c.color !== 'wild');
  const pool = nonWild.length > 0 ? nonWild : playable;
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  playBotCard(io, room, botId, chosen);
}

function playBotCard(io, room, botId, card) {
  const gs = room.gameState;

  let chosenColor = null;
  if (card.color === 'wild') {
    chosenColor = mostCommonColor(room.players.get(botId).hand.filter(c => c.id !== card.id));
  }

  const result = playCard(room, botId, card.id, chosenColor);
  if (result.error) return;

  io.to(`room:${room.code}`).emit('game:card_played', {
    playerId: botId,
    card: result.card,
    effect: result.effectResult.events,
  });
  io.to(`room:${room.code}`).emit('game:state_update', { gameState: getPublicGameView(gs) });

  if (result.won) {
    const rankings = computeRankings(room);
    io.to(`room:${room.code}`).emit('game:winner', {
      winnerId: botId,
      nickname: room.players.get(botId)?.nickname,
      rankings,
    });
    return;
  }

  const phase = gs.phase;

  if (phase === 'color_pick') {
    const color = chosenColor || 'red';
    gs.currentColor = color;
    advanceTurn(gs);
    gs.phase = 'play';
    gs.turnCount++;
    io.to(`room:${room.code}`).emit('game:color_chosen', { color });
    io.to(`room:${room.code}`).emit('game:state_update', { gameState: getPublicGameView(gs) });
    emitTurnAndSchedule(io, room);
    return;
  }

  if (phase === 'swap_target') {
    const targetId = pickSwapTarget(room, botId);
    if (targetId) {
      resolveSwapHands(room, botId, targetId);
      io.to(`room:${room.code}`).emit('game:swap_hands', { fromId: botId, toId: targetId });
    }
    // swap_hands also needs color pick — pick it now
    const color = chosenColor || mostCommonColor(room.players.get(botId).hand) || 'red';
    gs.currentColor = color;
    io.to(`room:${room.code}`).emit('game:color_chosen', { color });
    advanceTurn(gs);
    gs.phase = 'play';
    gs.turnCount++;
    io.to(`room:${room.code}`).emit('game:state_update', { gameState: getPublicGameView(gs) });
    emitTurnAndSchedule(io, room);
    return;
  }

  if (phase === 'discard_color_pick') {
    const color = chosenColor || mostCommonColor(room.players.get(botId).hand) || 'red';
    gs.currentColor = color;
    const len = gs.activePlayers.length;
    const targetIdx = ((gs.currentTurnIndex + gs.direction) % len + len) % len;
    const targetId = gs.activePlayers[targetIdx];
    const discardResult = resolveDiscardColor(room, targetId, color);
    if (!discardResult.blocked) {
      io.to(`room:${room.code}`).emit('game:discard_color', {
        playerId: targetId, color, discardedCount: discardResult.discardedCount,
      });
    }
    advanceTurn(gs);
    gs.phase = 'play';
    io.to(`room:${room.code}`).emit('game:state_update', { gameState: getPublicGameView(gs) });
    emitTurnAndSchedule(io, room);
    return;
  }

  if (phase === 'sabotage_target') {
    const targetId = pickSabotageTarget(room, botId);
    if (targetId) {
      gs.sabotageDepth = 1;
      const sabResult = resolveSabotage(room, targetId);
      if (sabResult.card) {
        io.to(`room:${room.code}`).emit('game:card_played', {
          playerId: targetId,
          card: sabResult.card,
          effect: [{ type: 'sabotaged', byId: botId }],
        });
        io.to(`room:${room.code}`).emit('game:state_update', { gameState: getPublicGameView(gs) });
      }
      gs.sabotageDepth = 0;
    }
    advanceTurn(gs);
    gs.phase = 'play';
    gs.turnCount++;
    io.to(`room:${room.code}`).emit('game:state_update', { gameState: getPublicGameView(gs) });
    emitTurnAndSchedule(io, room);
    return;
  }

  emitTurnAndSchedule(io, room);
}

export function emitTurnAndSchedule(io, room) {
  const gs = room.gameState;
  if (!gs || gs.phase === 'finished') return;
  const currentId = getCurrentPlayerId(gs);
  gs.turnStartedAt = Date.now();
  io.to(`room:${room.code}`).emit('game:turn', {
    currentPlayerId: currentId,
    timeoutAt: gs.turnStartedAt + gs.turnDurationMs,
  });
  if (isBotId(currentId)) {
    scheduleUnoBotTurn(io, room, currentId);
  }
}

function mostCommonColor(hand) {
  const counts = {};
  for (const c of hand) {
    if (c.color && c.color !== 'wild') counts[c.color] = (counts[c.color] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'red';
}

function pickSwapTarget(room, botId) {
  let best = null, bestCount = Infinity;
  for (const [id, p] of room.players) {
    if (id !== botId && p.hand.length < bestCount) {
      best = id; bestCount = p.hand.length;
    }
  }
  return best;
}

function pickSabotageTarget(room, botId) {
  let best = null, bestCount = Infinity;
  for (const [id, p] of room.players) {
    if (id !== botId && p.hand.length < bestCount) {
      best = id; bestCount = p.hand.length;
    }
  }
  return best;
}
