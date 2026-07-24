import { create } from 'zustand';

export const useTdStore = create((set) => ({
  gameState: null,
  spinResult: null,
  phase: null,

  setGameState: (gs) => set({ gameState: gs, phase: gs?.phase ?? null }),
  setSpinResult: (result) => set({ spinResult: result }),
  setPhase: (phase) => set({ phase }),
  reset: () => set({ gameState: null, spinResult: null, phase: null }),
}));
