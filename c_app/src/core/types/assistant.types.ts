import { DetectionDirection } from './detection.types';

export type AssistantIntentType =
  | 'APP_CONTROL'
  | 'CAMERA'
  | 'QUERY_SCENE'
  | 'QUERY_DIRECTION'
  | 'QUERY_DISTANCE'
  | 'QUERY_YES_NO'
  | 'ANNOUNCEMENTS'
  | 'HELP'
  | 'UNKNOWN';

export interface ParsedIntent {
  type: AssistantIntentType;
  action?: string;
  rawText: string;
  confidence: number;
  objectName?: string;
  direction?: DetectionDirection;
  maxSteps?: number;
  yesNoQuestion?: string;
  navigationTarget?: 'home' | 'settings' | 'back';
}

export interface AssistantResponse {
  spokenText: string;
  displayText?: string;
  shouldNavigate?: 'home' | 'settings' | 'back';
  shouldStartCamera?: boolean;
  shouldStopCamera?: boolean;
  shouldEnableAnnouncements?: boolean;
  shouldDisableAnnouncements?: boolean;
  shouldPauseAnnouncements?: boolean;
  shouldResumeAnnouncements?: boolean;
}