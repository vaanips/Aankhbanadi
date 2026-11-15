export type ActivityKind =
  | 'voice_command'
  | 'assistant_response'
  | 'announcement'
  | 'navigation'
  | 'camera'
  | 'error'
  | 'system';

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  title: string;
  detail?: string;
  timestamp: number;
  metadata?: Record<string, string | number | boolean>;
}