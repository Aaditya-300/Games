import { create } from 'zustand';

export const useChatStore = create((set, get) => ({
  messages: [],

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setHistory: (msgs) => set({ messages: msgs }),
  reset: () => set({ messages: [] }),
}));
