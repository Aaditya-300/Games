import { shuffle } from './utils/shuffle.js';
import { buildDeck } from './deckBuilder.js';
import { isPlayable } from './validators.js';
import { advanceTurn, getCurrentPlayerId } from './turnManager.js';
import { applyEffect } from './cardEffects.js';

export function initGameState(roomCode, playerIds) {
  return {
    roomCode,
    drawPile: [],
    discardPile: [],
    currentColor: null,
    currentValue: null,
    direction: 1,
    currentTurnIndex: 0,
    activePlayers: [...playerIds],
    pendingDraw: 0,
    pendingDrawType: null,
    phase: 'play',
    lastPlayedCard: null,
    lastPlayerId: null,
    lastPlayerHandSnapshot: null,
    wildDrawFourChallengeable: false,
    turnStartedAt: Date.now(),
    turnDurationMs: 30000,
    winner: null,
    turnCount: 0,
    unoCalled: new Set(),
    sabotageDepth: 0,
  };
}

export function startGame(room) {
  const playerIds = [...room.players.keys()].filter(
    id => !room.players.get(id).isSpectator
  );

  const gs = initGameState(room.code, playerIds);
  const deck = shuffle(buildDeck());

  // Deal 7 cards to each player
  for (const pid of playerIds) {
    const player = room.players.get(pid);
    player.hand = deck.splice(0, 7);
  }

  // Flip first discard — re-flip if Wild Draw 4
  let firstCard;
  do {
    firstCard = deck.splice(0, 1)[0];
  } while (firstCard.type === 'wild_draw4');

  gs.drawPile = deck;
  gs.discardPile = [firstCard];
  gs.currentColor = firstCard.color !== 'wild' ? firstCard.color : 'red';
  gs.currentValue = firstCard.type === 'number' ? firstCard.value : firstCard.type;

  room.gameState = gs;
  room.status = 'playing';

  // Apply first card effect without advancing turn yet
  const firstEffect = applyEffect(firstCard, room, null);
  if (firstEffect.needsColorPick) {
    gs.currentColor = 'red'; // default for wild first card
  }
  if (firstCard.type === 'reverse' && playerIds.length > 2) {
    gs.direction = -1;
    gs.currentTurnIndex = playerIds.length - 1;
  }
  if (firstCard.type === 'skip' || (firstCard.type === 'reverse' && playerIds.length === 2)) {
    advanceTurn(gs);
  }
  if (firstCard.type === 'draw2') {
    // first player draws 2 and is skipped
    const firstPlayer = room.players.get(getCurrentPlayerId(gs));
    const drawn = gs.drawPile.splice(0, 2);
    firstPlayer.hand.push(...drawn);
    gs.pendingDraw = 0;
    gs.pendingDrawType = null;
    advanceTurn(gs);
  }

  gs.turnStartedAt = Date.now();
  return gs;
}

export function playCard(room, playerId, cardId, chosenColor) {
  const gs = room.gameState;
  const player = room.players.get(playerId);

  if (getCurrentPlayerId(gs) !== playerId) {
    return { error: 'NOT_YOUR_TURN' };
  }
  if (gs.phase !== 'play') {
    return { error: 'WRONG_PHASE' };
  }

  const cardIdx = player.hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) return { error: 'CARD_NOT_IN_HAND' };

  const card = player.hand[cardIdx];
  if (!isPlayable(card, gs)) return { error: 'ILLEGAL_PLAY' };

  // Snapshot hand before removing card (for WD4 challenge)
  gs.lastPlayerHandSnapshot = [...player.hand];

  player.hand.splice(cardIdx, 1);
  gs.discardPile.push(card);
  gs.lastPlayedCard = card;
  gs.lastPlayerId = playerId;
  gs.wildDrawFourChallengeable = false;

  // Update current color/value
  if (card.color !== 'wild') {
    gs.currentColor = card.color;
  }
  gs.currentValue = card.type === 'number' ? card.value : card.type;

  const effectResult = applyEffect(card, room, playerId);

  // Handle color pick
  if (effectResult.needsColorPick) {
    if (chosenColor) {
      gs.currentColor = chosenColor;
      if (!effectResult.needsSwapTarget && !effectResult.needsDiscardColor && !effectResult.needsSabotageTarget) {
        effectResult.advance = true;
        if (card.type === 'wild_draw4') {
          // stay in play phase, advance after challenge window
        }
      }
    } else {
      gs.phase = effectResult.needsSwapTarget ? 'swap_target'
        : effectResult.needsDiscardColor ? 'discard_color_pick'
        : effectResult.needsSabotageTarget ? 'sabotage_target'
        : 'color_pick';
    }
  }

  // Check win condition
  if (player.hand.length === 0) {
    gs.winner = playerId;
    gs.phase = 'finished';
    room.status = 'finished';
    return { card, effectResult, won: true };
  }

  if (effectResult.advance) {
    advanceTurn(gs, effectResult.skipCount);
    gs.phase = 'play';
    gs.turnCount++;
  }

  return { card, effectResult, won: false };
}

export function drawCard(room, playerId) {
  const gs = room.gameState;
  if (getCurrentPlayerId(gs) !== playerId) return { error: 'NOT_YOUR_TURN' };
  if (gs.phase !== 'play') return { error: 'WRONG_PHASE' };

  const player = room.players.get(playerId);

  if (gs.pendingDraw > 0) {
    // Forced draw
    const count = gs.pendingDraw;
    ensureDrawPile(room);
    const drawn = gs.drawPile.splice(0, count);
    player.hand.push(...drawn);
    gs.pendingDraw = 0;
    gs.pendingDrawType = null;
    gs.wildDrawFourChallengeable = false;
    advanceTurn(gs);
    gs.turnCount++;
    return { drawn, forced: true };
  }

  // Voluntary draw
  ensureDrawPile(room);
  if (gs.drawPile.length === 0) return { error: 'EMPTY_DECK' };
  const [drawn] = gs.drawPile.splice(0, 1);
  player.hand.push(drawn);
  gs.phase = 'drawn'; // player may now play or pass
  return { drawn: [drawn], forced: false };
}

export function pass(room, playerId) {
  const gs = room.gameState;
  if (getCurrentPlayerId(gs) !== playerId) return { error: 'NOT_YOUR_TURN' };
  if (gs.phase !== 'drawn') return { error: 'MUST_DRAW_FIRST' };
  advanceTurn(gs);
  gs.phase = 'play';
  gs.turnCount++;
  return { ok: true };
}

export function resolveColorPick(room, playerId, color) {
  const gs = room.gameState;
  if (gs.lastPlayerId !== playerId) return { error: 'NOT_AUTHORIZED' };
  if (!['red', 'blue', 'green', 'yellow'].includes(color)) return { error: 'INVALID_COLOR' };
  gs.currentColor = color;
  if (gs.phase === 'color_pick') {
    advanceTurn(gs);
    gs.phase = 'play';
    gs.turnCount++;
  }
  return { ok: true };
}

export function computeRankings(room) {
  const players = [...room.players.values()].filter(p => !p.isSpectator);
  return players
    .sort((a, b) => a.hand.length - b.hand.length)
    .map((p, i) => ({ rank: i + 1, id: p.id, nickname: p.nickname, cardCount: p.hand.length }));
}

function ensureDrawPile(room) {
  const gs = room.gameState;
  if (gs.drawPile.length === 0 && gs.discardPile.length > 1) {
    const top = gs.discardPile[gs.discardPile.length - 1];
    gs.drawPile = shuffle(gs.discardPile.slice(0, -1));
    gs.discardPile = [top];
  }
}
