import { create } from 'zustand';

export const useUiStore = create((set) => ({
  showColorPicker: false,
  showSwapTarget: false,
  showDiscardColor: false,
  showSabotageTarget: false,
  showChallenge: false,
  challengeTimeoutAt: null,
  toasts: [],

  openColorPicker: () => set({ showColorPicker: true }),
  closeColorPicker: () => set({ showColorPicker: false }),
  openSwapTarget: () => set({ showSwapTarget: true }),
  closeSwapTarget: () => set({ showSwapTarget: false }),
  openDiscardColor: () => set({ showDiscardColor: true }),
  closeDiscardColor: () => set({ showDiscardColor: false }),
  openSabotageTarget: () => set({ showSabotageTarget: true }),
  closeSabotageTarget: () => set({ showSabotageTarget: false }),
  openChallenge: (timeoutAt) => set({ showChallenge: true, challengeTimeoutAt: timeoutAt }),
  closeChallenge: () => set({ showChallenge: false, challengeTimeoutAt: null }),

  addToast: (msg, type = 'info') =>
    set((s) => ({ toasts: [...s.toasts, { id: Date.now() + Math.random(), msg, type }] })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  reset: () => set({
    showColorPicker: false, showSwapTarget: false, showDiscardColor: false,
    showSabotageTarget: false, showChallenge: false, toasts: [],
  }),
}));
