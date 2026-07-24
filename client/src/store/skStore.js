import { create } from 'zustand';

export const useSkStore = create((set, get) => ({
  gameState: null,
  drawStrokes: [],
  guesses: [],
  wordOptions: null,
  currentWord: null,
  hint: null,
  phase: null,
  roundEndsAt: null,
  turnResult: null,
  gameOver: null,

  setGameState: (gs) => set({ gameState: gs, phase: gs?.phase ?? null }),

  setWordOptions: (options) => set({ wordOptions: options }),

  setCurrentWord: (word) => set({ currentWord: word }),

  setHint: (hint) => set({ hint }),

  startRound: ({ drawerId, drawerNickname, hint, roundEndsAt, round, totalRounds }) => set(s => ({
    hint,
    roundEndsAt,
    drawStrokes: [],
    guesses: [],
    turnResult: null,
    phase: 'drawing',
    wordOptions: null,
    currentWord: null,
    gameState: s.gameState ? {
      ...s.gameState,
      phase: 'drawing',
      currentDrawerId: drawerId,
      round,
      totalRounds,
      roundEndsAt,
    } : null,
  })),

  addStroke: (stroke) => set(s => ({ drawStrokes: [...s.drawStrokes, stroke] })),

  clearStrokes: () => set({ drawStrokes: [] }),

  addGuess: (guess) => set(s => ({ guesses: [...s.guesses, guess] })),

  setCorrectGuess: (data) => set({ turnResult: { type: 'correct_guess', ...data } }),

  setTurnEnded: ({ word, scores, correctGuessers, drawerId }) => set(s => ({
    phase: 'turn_end',
    turnResult: { word, scores, correctGuessers, drawerId },
    gameState: s.gameState ? { ...s.gameState, phase: 'turn_end', scores } : null,
  })),

  setRoundEnded: ({ round, scores }) => set(s => ({
    phase: 'round_end',
    gameState: s.gameState ? { ...s.gameState, phase: 'round_end', scores, round } : null,
  })),

  setNextDrawer: ({ drawerId, drawerNickname, gameState }) => set({
    phase: 'word_pick',
    drawStrokes: [],
    guesses: [],
    turnResult: null,
    hint: null,
    currentWord: null,
    // wordOptions intentionally NOT reset here — sk:word_options arrives before this event
    // and resetting it would wipe the options the drawer needs to see
    gameState,
  }),

  setGameOver: ({ scores }) => set(s => ({
    phase: 'game_over',
    gameState: s.gameState ? { ...s.gameState, phase: 'game_over', scores } : null,
  })),

  reset: () => set({
    gameState: null,
    drawStrokes: [],
    guesses: [],
    wordOptions: null,
    currentWord: null,
    hint: null,
    phase: null,
    roundEndsAt: null,
    turnResult: null,
    gameOver: null,
  }),
}));
