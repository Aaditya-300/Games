import { advanceTurn, reverseDirection } from './turnManager.js';
import { shuffle } from './utils/shuffle.js';

function getPlayerById(room, playerId) {
  return room.players.get(playerId) || room.spectators.get(playerId);
}

function getNextActivePlayerId(gameState) {
  const { activePlayers, currentTurnIndex, direction } = gameState;
  const len = activePlayers.length;
  const next = ((currentTurnIndex + direction) % len + len) % len;
  return activePlayers[next];
}

function ensureDrawPile(room) {
  const gs = room.gameState;
  if (gs.drawPile.length === 0) {
    const top = gs.discardPile[gs.discardPile.length - 1];
    gs.drawPile = shuffle(gs.discardPile.slice(0, -1));
    gs.discardPile = [top];
  }
}

function drawCards(room, playerId, count) {
  const gs = room.gameState;
  const player = getPlayerById(room, playerId);
  const drawn = [];
  for (let i = 0; i < count; i++) {
    ensureDrawPile(room);
    if (gs.drawPile.length === 0) break;
    drawn.push(gs.drawPile.pop());
  }
  player.hand.push(...drawn);
  return drawn;
}

// Returns { advance: boolean, skipCount: number, needsColorPick: boolean,
//           needsSwapTarget: boolean, needsDiscardColor: boolean, events: [] }
export function applyEffect(card, room, actingPlayerId) {
  const gs = room.gameState;
  const result = { advance: true, skipCount: 0, needsColorPick: false, events: [] };

  switch (card.type) {
    case 'number':
      // no effect
      break;

    case 'skip':
      result.skipCount = 1;
      result.events.push({ type: 'skip', targetId: getNextActivePlayerId(gs) });
      break;

    case 'reverse':
      reverseDirection(gs);
      if (gs.activePlayers.length === 2) {
        // With 2 players reverse acts like skip
        result.skipCount = 1;
      }
      result.events.push({ type: 'reverse' });
      break;

    case 'draw2':
      gs.pendingDraw += 2;
      gs.pendingDrawType = 'draw2';
      result.events.push({ type: 'draw_pending', total: gs.pendingDraw, drawType: 'draw2' });
      break;

    case 'wild':
      result.needsColorPick = true;
      result.advance = false;
      break;

    case 'wild_draw4':
      gs.pendingDraw += 4;
      gs.pendingDrawType = 'wild_draw4';
      gs.wildDrawFourChallengeable = true;
      result.needsColorPick = true;
      result.advance = false;
      result.events.push({ type: 'draw_pending', total: gs.pendingDraw, drawType: 'wild_draw4' });
      break;

    case 'swap_hands': {
      result.needsColorPick = true;
      result.advance = false;
      result.needsSwapTarget = true;
      break;
    }

    case 'shield': {
      const player = getPlayerById(room, actingPlayerId);
      player.shieldActive = true;
      result.events.push({ type: 'shield_activated', playerId: actingPlayerId });
      break;
    }

    case 'draw_until_color':
      result.needsColorPick = true;
      result.advance = false;
      break;

    case 'discard_color':
      result.needsColorPick = true;
      result.advance = false;
      result.needsDiscardColor = true;
      break;

    case 'peek':
      // Handled after effect application — server emits peek_result privately
      result.events.push({ type: 'peek', byId: actingPlayerId });
      break;

    case 'sabotage':
      result.needsColorPick = false;
      result.needsSabotageTarget = true;
      result.advance = false;
      break;
  }

  return result;
}

export function resolveDrawUntilColor(room, targetId, chosenColor) {
  const gs = room.gameState;
  const target = getPlayerById(room, targetId);

  if (target.shieldActive) {
    target.shieldActive = false;
    return { blocked: true, drawnCount: 0, stopCard: null };
  }

  const drawn = [];
  let stopCard = null;
  const maxDraws = gs.drawPile.length + gs.discardPile.length - 1;

  for (let i = 0; i < maxDraws + 1; i++) {
    ensureDrawPile(room);
    if (gs.drawPile.length === 0) break;
    const c = gs.drawPile.pop();
    target.hand.push(c);
    drawn.push(c);
    if (c.color === chosenColor) {
      stopCard = c;
      break;
    }
  }

  return { blocked: false, drawnCount: drawn.length, stopCard };
}

export function resolveDiscardColor(room, targetId, chosenColor) {
  const target = getPlayerById(room, targetId);

  if (target.shieldActive) {
    target.shieldActive = false;
    return { blocked: true, discardedCount: 0 };
  }

  const gs = room.gameState;
  const toDiscard = target.hand.filter(c => c.color === chosenColor);
  target.hand = target.hand.filter(c => c.color !== chosenColor);
  gs.discardPile.push(...toDiscard);

  const discardedCount = toDiscard.length;
  if (toDiscard.length > 0) {
    const last = toDiscard[toDiscard.length - 1];
    gs.currentColor = last.color;
    gs.currentValue = last.type === 'number' ? last.value : last.type;
  }

  return { blocked: false, discardedCount };
}

export function resolveSwapHands(room, actingPlayerId, targetId) {
  const actor = getPlayerById(room, actingPlayerId);
  const target = getPlayerById(room, targetId);

  if (target.shieldActive) {
    target.shieldActive = false;
    return { blocked: true };
  }

  const actorHand = actor.hand;
  actor.hand = target.hand;
  target.hand = actorHand;

  return { blocked: false };
}

export function resolveSabotage(room, targetId) {
  const gs = room.gameState;
  const target = getPlayerById(room, targetId);

  if (target.shieldActive) {
    target.shieldActive = false;
    return { blocked: true, card: null };
  }

  if (target.hand.length === 0) return { blocked: false, card: null };

  const idx = Math.floor(Math.random() * target.hand.length);
  const [forcedCard] = target.hand.splice(idx, 1);

  // Apply the forced card to the game state (but don't trigger win for the target)
  gs.discardPile.push(forcedCard);
  if (forcedCard.color !== 'wild') {
    gs.currentColor = forcedCard.color;
  }
  gs.currentValue = forcedCard.type === 'number' ? forcedCard.value : forcedCard.type;

  return { blocked: false, card: forcedCard };
}

export function resolveChallenge(room, challengerId, challengedId) {
  const gs = room.gameState;
  const challenged = getPlayerById(room, challengedId);
  const snapshot = gs.lastPlayerHandSnapshot || [];

  // Check if challenged player had any card matching current color (before WD4 was played)
  const hadMatch = snapshot.some(c => c.color === gs.currentColor);

  if (hadMatch) {
    // Illegal WD4 — challenged draws 4
    drawCards(room, challengedId, 4);
    gs.pendingDraw = 0;
    gs.pendingDrawType = null;
    return { success: true, drawn: 4, penalizedId: challengedId };
  } else {
    // Legal WD4 — challenger draws 4+2=6
    drawCards(room, challengerId, 6);
    gs.pendingDraw = 0;
    gs.pendingDrawType = null;
    return { success: false, drawn: 6, penalizedId: challengerId };
  }
}

export function forceDraw(room, playerId) {
  const gs = room.gameState;
  const count = gs.pendingDraw > 0 ? gs.pendingDraw : 1;
  const drawn = drawCards(room, playerId, count);
  gs.pendingDraw = 0;
  gs.pendingDrawType = null;
  gs.wildDrawFourChallengeable = false;
  return { count, drawn };
}

export { drawCards };
