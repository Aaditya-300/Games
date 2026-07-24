import { create } from 'zustand';

export const useIqStore = create((set) => ({
  gameState: null,
  question: null,
  questionEndsAt: null,
  phase: null,
  answeredCount: 0,
  totalPlayers: 0,
  myAnswer: null,
  reveal: null,
  gameOver: null,

  setGameState: (gs) => set({ gameState: gs, phase: gs?.phase ?? null }),

  setQuestion: ({ questionIndex, totalQuestions, text, options, questionEndsAt }) => set(s => ({
    phase: 'question',
    question: { questionIndex, totalQuestions, text, options },
    questionEndsAt,
    answeredCount: 0,
    myAnswer: null,
    reveal: null,
    gameState: s.gameState ? {
      ...s.gameState,
      phase: 'question',
      questionIndex,
      totalQuestions,
      question: { text, options },
      questionEndsAt,
    } : null,
  })),

  setAnswerLocked: (optionIndex) => set({ myAnswer: optionIndex }),

  setPlayerAnswered: ({ answeredCount, total }) => set({ answeredCount, totalPlayers: total }),

  setReveal: ({ correctIndex, correctText, perPlayer, scores }) => set(s => ({
    phase: 'reveal',
    reveal: { correctIndex, correctText, perPlayer },
    gameState: s.gameState ? { ...s.gameState, phase: 'reveal', scores } : null,
  })),

  setGameOver: ({ scores }) => set(s => ({
    phase: 'game_over',
    gameState: s.gameState ? { ...s.gameState, phase: 'game_over', scores } : null,
  })),

  reset: () => set({
    gameState: null,
    question: null,
    questionEndsAt: null,
    phase: null,
    answeredCount: 0,
    totalPlayers: 0,
    myAnswer: null,
    reveal: null,
    gameOver: null,
  }),
}));
