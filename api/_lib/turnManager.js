export function nextTurnIndex(currentIndex, activePlayers, direction, skipCount = 0) {
  const len = activePlayers.length;
  if (len === 0) return 0;
  let idx = currentIndex;
  for (let i = 0; i <= skipCount; i++) {
    idx = ((idx + direction) % len + len) % len;
  }
  return idx;
}

export function advanceTurn(gameState, skipCount = 0) {
  gameState.currentTurnIndex = nextTurnIndex(
    gameState.currentTurnIndex,
    gameState.activePlayers,
    gameState.direction,
    skipCount
  );
  gameState.turnStartedAt = Date.now();
}

export function reverseDirection(gameState) {
  gameState.direction = gameState.direction === 1 ? -1 : 1;
}

export function getCurrentPlayerId(gameState) {
  return gameState.activePlayers[gameState.currentTurnIndex];
}
