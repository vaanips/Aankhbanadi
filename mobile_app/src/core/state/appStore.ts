import { create } from 'zustand';

interface AppState {
  initialized: boolean;
  onboardingComplete: boolean;
  setInitialized: (initialized: boolean) => void;
  setOnboardingComplete: (complete: boolean) => void;
}

export const useAppStore = create<AppState>(set => ({
  initialized: false,
  onboardingComplete: false,
  setInitialized: initialized => set({ initialized }),
  setOnboardingComplete: onboardingComplete => set({ onboardingComplete }),
}));
