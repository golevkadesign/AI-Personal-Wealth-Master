import { create } from 'zustand';

interface SDUIEvent {
  type: string;
  payload?: any;
}

interface SDUIEventStore {
  lastEvent: SDUIEvent | null;
  dispatch: (type: string, payload?: any) => void;
  clearEvent: () => void;
}

export const useSDUIEventStore = create<SDUIEventStore>((set) => ({
  lastEvent: null,
  dispatch: (type, payload) => set({ lastEvent: { type, payload } }),
  clearEvent: () => set({ lastEvent: null }),
}));
