import { create } from 'zustand';
import { StorageService } from '../services/StorageService';
import { STORAGE_KEYS } from '../utils/constants';

export interface UdidAuthRecord {
  authenticated: boolean;
  udid?: string | null;
  disabilityType?: string | null;
  disabilityPercentage?: string | null;
  authenticatedAt: number;
}

interface AuthState {
  hydrated: boolean;
  authenticated: boolean;
  record: UdidAuthRecord | null;
  hydrate: () => Promise<void>;
  setAuthenticated: (record: UdidAuthRecord) => Promise<void>;
  clearAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  hydrated: false,
  authenticated: false,
  record: null,

  hydrate: async () => {
    if (get().hydrated) {
      return;
    }
    const saved = await StorageService.get<UdidAuthRecord>(STORAGE_KEYS.udidAuth);
    if (saved?.authenticated) {
      set({ hydrated: true, authenticated: true, record: saved });
    } else {
      set({ hydrated: true, authenticated: false, record: null });
    }
  },

  setAuthenticated: async record => {
    await StorageService.set(STORAGE_KEYS.udidAuth, record);
    set({ authenticated: true, record });
  },

  clearAuth: async () => {
    await StorageService.remove(STORAGE_KEYS.udidAuth);
    set({ authenticated: false, record: null });
  },
}));
