import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultSettings, type AppSettings } from '../state/settingsStore';
import type { HistoryEntry } from '../types/voice.types';

const SETTINGS_KEY = '@drishti/settings';
const HISTORY_KEY = '@drishti/history';
const ONBOARDING_KEY = '@drishti/onboarding-complete';

export const storageService = {
  async loadSettings(): Promise<AppSettings> {
    const stored = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!stored) return defaultSettings;
    return { ...defaultSettings, ...(JSON.parse(stored) as Partial<AppSettings>) };
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },

  async loadHistory(): Promise<HistoryEntry[]> {
    const stored = await AsyncStorage.getItem(HISTORY_KEY);
    return stored ? (JSON.parse(stored) as HistoryEntry[]) : [];
  },

  async saveHistory(entries: HistoryEntry[]): Promise<void> {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 100)));
  },

  async clearHistory(): Promise<void> {
    await AsyncStorage.removeItem(HISTORY_KEY);
  },

  async hasCompletedOnboarding(): Promise<boolean> {
    return (await AsyncStorage.getItem(ONBOARDING_KEY)) === 'true';
  },

  async completeOnboarding(): Promise<void> {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  },

  async clearPreferences(): Promise<void> {
    await AsyncStorage.removeItem(SETTINGS_KEY);
  },
};
