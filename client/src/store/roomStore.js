import { create } from 'zustand';

export const useRoomStore = create((set) => ({
  room: null,
  myId: null,
  isSpectator: false,

  setRoom: (room) => set({ room }),
  setMyId: (id) => set({ myId: id }),
  setIsSpectator: (val) => set({ isSpectator: val }),
  reset: () => set({ room: null, myId: null, isSpectator: false }),
}));
