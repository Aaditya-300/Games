const WILD_TYPES = new Set([
  'wild', 'wild_draw4', 'swap_hands', 'draw_until_color', 'discard_color', 'sabotage',
]);

const STACK_ON_DRAW2 = new Set(['draw2']);
const STACK_ON_DRAW4 = new Set(['wild_draw4']);

export function isPlayable(card, gameState) {
  const { pendingDraw, pendingDrawType, currentColor, currentValue } = gameState;

  // When there's a pending draw stack, only matching stacking cards are legal
  if (pendingDraw > 0) {
    if (pendingDrawType === 'draw2') return STACK_ON_DRAW2.has(card.type);
    if (pendingDrawType === 'wild_draw4') return STACK_ON_DRAW4.has(card.type);
    return false;
  }

  if (WILD_TYPES.has(card.type)) return true;
  if (card.color === currentColor) return true;
  if (card.type !== 'number' && card.type === currentValue) return true;
  if (card.type === 'number' && card.value === currentValue) return true;

  return false;
}

export function hasAnyPlayableCard(hand, gameState) {
  return hand.some(c => isPlayable(c, gameState));
}

export function isWildType(type) {
  return WILD_TYPES.has(type);
}
