import { create } from 'zustand';

export const useGameStore = create((set) => ({
  gameState: null,   // public game state
  hand: [],          // my private hand
  winner: null,
  rankings: [],
  peekData: null,    // { targetNickname, hand }
  turnTimeout: null, // timeoutAt timestamp

  setGameState: (gs) => set({ gameState: gs }),
  setHand: (hand) => set({ hand }),
  setWinner: (winnerId, nickname, rankings) => set({ winner: { winnerId, nickname }, rankings }),
  setPeekData: (data) => set({ peekData: data }),
  clearPeek: () => set({ peekData: null }),
  setTurnTimeout: (timeoutAt) => set({ turnTimeout: timeoutAt }),
  reset: () => set({ gameState: null, hand: [], winner: null, rankings: [], peekData: null, turnTimeout: null }),
}));
