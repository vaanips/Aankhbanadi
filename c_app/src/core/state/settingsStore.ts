import { create } from 'zustand';
import { StorageService } from '../services/StorageService';
import { STORAGE_KEYS } from '../utils/constants';
import { createLogger } from '../utils/logger';

const log = createLogger('SettingsStore');

export type ThemeModeSetting = 'light' | 'dark' | 'system';
export type VerbosityLevel = 'concise' | 'detailed';

export interface PersistedSettings {
  themeMode: ThemeModeSetting;
  speechRate: number;
  speechVolume: number;
  voiceEnabled: boolean;
  highContrast: boolean;
  largeText: boolean;
  hapticEnabled: boolean;
  pushToTalk: boolean;
  verbosity: VerbosityLevel;
}

const defaultSettings: PersistedSettings = {
  themeMode: 'system',
  speechRate: 0.5,
  speechVolume: 1.0,
  voiceEnabled: true,
  highContrast: false,
  largeText: false,
  hapticEnabled: true,
  pushToTalk: true,
  verbosity: 'concise',
};

interface SettingsState extends PersistedSettings {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  save: () => Promise<void>;
  update: (patch: Partial<PersistedSettings>) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...defaultSettings,
  hydrated: false,
  hydrate: async () => {
    try {
      const stored = await StorageService.get<PersistedSettings>(STORAGE_KEYS.settings);
      if (stored) {
        set({ ...defaultSettings, ...stored, hydrated: true });
      } else {
        set({ hydrated: true });
      }
    } catch (error) {
      log.warn('Failed to hydrate settings', error);
      set({ hydrated: true });
    }
  },
  save: async () => {
    const {
      themeMode,
      speechRate,
      speechVolume,
      voiceEnabled,
      highContrast,
      largeText,
      hapticEnabled,
      pushToTalk,
      verbosity,
    } = get();
    const payload: PersistedSettings = {
      themeMode,
      speechRate,
      speechVolume,
      voiceEnabled,
      highContrast,
      largeText,
      hapticEnabled,
      pushToTalk,
      verbosity,
    };
    try {
      await StorageService.set(STORAGE_KEYS.settings, payload);
    } catch (error) {
      log.error('Failed to save settings', error);
    }
  },
  update: patch => {
    set(patch);
    void get().save();
  },
  reset: () => {
    set({ ...defaultSettings });
    void get().save();
  },
}));