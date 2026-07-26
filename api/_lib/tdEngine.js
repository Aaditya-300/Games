import { TRUTHS, DARES } from './tdCards.js';

export function initTdGameState(roomCode, spinnerQueue) {
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

export function pickCard(gameState, type) {
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

export function getTdPublicView(gs) {
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
