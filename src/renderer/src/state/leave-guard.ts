// Protege el documento con cambios antes de cerrarlo, abrir otro o crear uno nuevo.
import { create } from 'zustand';
import { useApp } from './app-store';

interface LeaveState {
  pending: (() => void) | null;
  request(action: () => void): void;
  clear(): void;
}

export const useLeaveGuard = create<LeaveState>()((set) => ({
  pending: null,
  request: (action) => {
    if (useApp.getState().doc?.dirty) set({ pending: action });
    else action();
  },
  clear: () => set({ pending: null }),
}));

export const requestLeave = (action: () => void) => useLeaveGuard.getState().request(action);
