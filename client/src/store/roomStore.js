import { create } from 'zustand';

export const useRoomStore = create((set) => ({
  room: null,
  reconnectToken: null,
  myId: null,
  isSpectator: false,

  setRoom: (room) => set({ room }),
  setReconnectToken: (token) => set({ reconnectToken: token }),
  setMyId: (id) => set({ myId: id }),
  setIsSpectator: (val) => set({ isSpectator: val }),
  reset: () => set({ room: null, reconnectToken: null, myId: null, isSpectator: false }),
}));
