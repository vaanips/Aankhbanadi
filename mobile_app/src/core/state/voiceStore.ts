import { create } from 'zustand';
import type { AssistantState } from '../types/voice.types';

const transitions: Record<AssistantState, AssistantState[]> = {
  IDLE: ['LISTENING', 'PROCESSING', 'SPEAKING', 'PAUSED', 'ERROR'],
  LISTENING: ['PROCESSING', 'IDLE', 'PAUSED', 'ERROR'],
  PROCESSING: ['SPEAKING', 'IDLE', 'ERROR'],
  SPEAKING: ['IDLE', 'LISTENING', 'ERROR'],
  PAUSED: ['IDLE', 'LISTENING', 'SPEAKING', 'ERROR'],
  ERROR: ['IDLE', 'LISTENING'],
};

interface VoiceState {
  assistantState: AssistantState;
  recognizedText: string;
  currentResponse: string;
  announcementsEnabled: boolean;
  setAssistantState: (state: AssistantState) => boolean;
  setRecognizedText: (text: string) => void;
  setCurrentResponse: (text: string) => void;
  setAnnouncementsEnabled: (enabled: boolean) => void;
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
  assistantState: 'IDLE',
  recognizedText: '',
  currentResponse: '',
  announcementsEnabled: true,
  setAssistantState: next => {
    const current = get().assistantState;
    if (current !== next && !transitions[current].includes(next)) {
      return false;
    }
    set({ assistantState: next });
    return true;
  },
  setRecognizedText: recognizedText => set({ recognizedText }),
  setCurrentResponse: currentResponse => set({ currentResponse }),
  setAnnouncementsEnabled: announcementsEnabled => set({ announcementsEnabled }),
}));
