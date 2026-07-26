import { useGameStore } from '../store/gameStore';
import { useRoomStore } from '../store/roomStore';
import { getPlayerId } from '../identity';

const WILD_TYPES = new Set(['wild', 'wild_draw4', 'swap_hands', 'draw_until_color', 'discard_color', 'sabotage']);

export function useGame() {
  const { gameState, hand } = useGameStore();
  const { myId } = useRoomStore();

  const isMyTurn = gameState?.currentPlayerId === (myId || getPlayerId());

  const legalCards = hand.filter(card => {
    if (!gameState) return false;
    const { pendingDraw, pendingDrawType, currentColor, currentValue } = gameState;

    if (pendingDraw > 0) {
      if (pendingDrawType === 'draw2') return card.type === 'draw2';
      if (pendingDrawType === 'wild_draw4') return card.type === 'wild_draw4';
      return false;
    }

    if (WILD_TYPES.has(card.type)) return true;
    if (card.color === currentColor) return true;
    if (card.type !== 'number' && card.type === currentValue) return true;
    if (card.type === 'number' && card.value === currentValue) return true;
    return false;
  });

  const topCard = gameState?.topCard || null;
  const currentColor = gameState?.currentColor || null;
  const pendingDraw = gameState?.pendingDraw || 0;
  const phase = gameState?.phase || null;

  return { isMyTurn, legalCards, topCard, currentColor, pendingDraw, phase, gameState, hand };
}
