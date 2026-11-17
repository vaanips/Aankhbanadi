export type VoiceAssistantState =
  | 'IDLE'
  | 'LISTENING'
  | 'PROCESSING'
  | 'SPEAKING'
  | 'PAUSED'
  | 'ERROR';

export type SpeechPriority = 'low' | 'normal' | 'high' | 'critical';

export interface SpeechRequest {
  id: string;
  text: string;
  priority: SpeechPriority;
  createdAt: number;
  interruptible?: boolean;
  onDone?: () => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
}

export const SPEECH_PRIORITY_ORDER: Record<SpeechPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3,
};