import { create } from 'zustand';

export interface AppSettings {
  theme: 'light' | 'dark';
  highContrast: boolean;
  largeText: boolean;
  voiceAssistantEnabled: boolean;
  pushToTalk: boolean;
  speechRate: number;
  speechVolume: number;
  automaticAnnouncements: boolean;
  hapticFeedback: boolean;
  verboseResponses: boolean;
}

export const defaultSettings: AppSettings = {
  theme: 'light',
  highContrast: false,
  largeText: false,
  voiceAssistantEnabled: true,
  pushToTalk: true,
  speechRate: 0.48,
  speechVolume: 1,
  automaticAnnouncements: true,
  hapticFeedback: true,
  verboseResponses: false,
};

interface SettingsState extends AppSettings {
  updateSettings: (settings: Partial<AppSettings>) => void;
  replaceSettings: (settings: AppSettings) => void;
}

export const useSettingsStore = create<SettingsState>(set => ({
  ...defaultSettings,
  updateSettings: patch => set(state => ({ ...state, ...patch })),
  replaceSettings: settings => set(settings),
}));
