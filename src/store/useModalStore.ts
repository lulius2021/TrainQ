import { create } from "zustand";

interface ModalStore {
  openCount: number;
  push: () => void;
  pop: () => void;
}

export const useModalStore = create<ModalStore>((set) => ({
  openCount: 0,
  push: () => set((s) => ({ openCount: s.openCount + 1 })),
  pop:  () => set((s) => ({ openCount: Math.max(0, s.openCount - 1) })),
}));
