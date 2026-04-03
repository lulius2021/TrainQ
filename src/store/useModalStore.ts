import { create } from "zustand";

interface ModalStore {
  openCount: number;
  shieldActive: boolean;
  push: () => void;
  pop: () => void;
  /** Call after any close/back action to absorb the resulting ghost-click for 400ms */
  activateShield: () => void;
}

let shieldTimer: ReturnType<typeof setTimeout> | null = null;

export const useModalStore = create<ModalStore>((set) => ({
  openCount: 0,
  shieldActive: false,
  push: () => set((s) => ({ openCount: s.openCount + 1 })),
  pop:  () => set((s) => ({ openCount: Math.max(0, s.openCount - 1) })),
  activateShield: () => {
    if (shieldTimer) clearTimeout(shieldTimer);
    set({ shieldActive: true });
    shieldTimer = setTimeout(() => set({ shieldActive: false }), 400);
  },
}));
