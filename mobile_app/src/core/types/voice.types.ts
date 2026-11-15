export type AssistantState =
  | 'IDLE'
  | 'LISTENING'
  | 'PROCESSING'
  | 'SPEAKING'
  | 'PAUSED'
  | 'ERROR';

export type Intent =
  | { type: 'help' }
  | { type: 'go-home' }
  | { type: 'open-settings' }
  | { type: 'open-camera' }
  | { type: 'stop-camera' }
  | { type: 'enable-announcements' }
  | { type: 'disable-announcements' }
  | { type: 'repeat-response' }
  | { type: 'query'; query: string }
  | { type: 'unknown'; query: string };

export type HistoryEntryType =
  | 'camera'
  | 'question'
  | 'announcement'
  | 'system';

export interface HistoryEntry {
  id: string;
  timestamp: number;
  type: HistoryEntryType;
  description: string;
  status: 'complete' | 'info' | 'error';
}
