import { storageService } from './StorageService';
import type { HistoryEntry, HistoryEntryType } from '../types/voice.types';

export const historyService = {
  async add(
    type: HistoryEntryType,
    description: string,
    status: HistoryEntry['status'] = 'complete',
  ): Promise<void> {
    const entries = await storageService.loadHistory();
    const item: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      type,
      description,
      status,
    };
    await storageService.saveHistory([item, ...entries]);
  },
};
