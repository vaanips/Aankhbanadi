import { create } from 'zustand';
import { ActivityEntry } from '../types/activity.types';
import { StorageService } from '../services/StorageService';
import { MAX_ACTIVITY_ENTRIES, STORAGE_KEYS } from '../utils/constants';
import { createLogger } from '../utils/logger';

const log = createLogger('ActivityStore');

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface ActivityState {
  entries: ActivityEntry[];
  hydrated: boolean;
  addEntry: (entry: Omit<ActivityEntry, 'id' | 'timestamp'> & { timestamp?: number }) => void;
  clearHistory: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  entries: [],
  hydrated: false,
  addEntry: partial => {
    const entry: ActivityEntry = {
      id: generateId(),
      timestamp: partial.timestamp ?? Date.now(),
      kind: partial.kind,
      title: partial.title,
      detail: partial.detail,
      metadata: partial.metadata,
    };
    set(state => {
      const next = [entry, ...state.entries].slice(0, MAX_ACTIVITY_ENTRIES);
      void StorageService.set(STORAGE_KEYS.activity, next);
      return { entries: next };
    });
  },
  clearHistory: async () => {
    set({ entries: [] });
    try {
      await StorageService.remove(STORAGE_KEYS.activity);
    } catch (error) {
      log.warn('Failed to clear activity storage', error);
    }
  },
  hydrate: async () => {
    try {
      const stored = await StorageService.get<ActivityEntry[]>(STORAGE_KEYS.activity);
      set({ entries: stored ?? [], hydrated: true });
    } catch (error) {
      log.warn('Failed to hydrate activity', error);
      set({ hydrated: true });
    }
  },
}));