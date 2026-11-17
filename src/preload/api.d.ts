import type { DwApi } from '../shared/ipc';

declare global {
  interface Window {
    dw: DwApi;
  }
}

export {};
