import { create } from 'zustand';
import { DEMO_MODE } from '../utils/constants';

export type AppInitStatus = 'idle' | 'initializing' | 'ready' | 'error';

interface AppState {
  initStatus: AppInitStatus;
  onboardingComplete: boolean;
  startupAnnounced: boolean;
  demoMode: boolean;
  lastError: string | null;
  setInitStatus: (status: AppInitStatus, error?: string | null) => void;
  markStartupAnnounced: () => void;
  setOnboardingComplete: (complete: boolean) => void;
  setDemoMode: (enabled: boolean) => void;
}

export const useAppStore = create<AppState>(set => ({
  initStatus: 'idle',
  onboardingComplete: false,
  startupAnnounced: false,
  demoMode: DEMO_MODE,
  lastError: null,
  setInitStatus: (status, error = null) =>
    set({ initStatus: status, lastError: error }),
  markStartupAnnounced: () => set({ startupAnnounced: true }),
  setOnboardingComplete: complete => set({ onboardingComplete: complete }),
  setDemoMode: enabled => set({ demoMode: enabled }),
}));