import { create } from 'zustand';
import { VoiceAssistantState } from '../types/voice.types';

interface VoiceState {
  state: VoiceAssistantState;
  recognizedText: string;
  responseText: string;
  announcementsEnabled: boolean;
  announcementsPaused: boolean;
  lastError: string | null;
  setState: (state: VoiceAssistantState) => void;
  setRecognizedText: (text: string) => void;
  setResponseText: (text: string) => void;
  setAnnouncementsEnabled: (enabled: boolean) => void;
  setAnnouncementsPaused: (paused: boolean) => void;
  setLastError: (error: string | null) => void;
  resetSession: () => void;
}

export const useVoiceStore = create<VoiceState>(set => ({
  state: 'IDLE',
  recognizedText: '',
  responseText: '',
  announcementsEnabled: true,
  announcementsPaused: false,
  lastError: null,
  setState: state => set({ state }),
  setRecognizedText: recognizedText => set({ recognizedText }),
  setResponseText: responseText => set({ responseText }),
  setAnnouncementsEnabled: announcementsEnabled => set({ announcementsEnabled }),
  setAnnouncementsPaused: announcementsPaused => set({ announcementsPaused }),
  setLastError: lastError => set({ lastError }),
  resetSession: () =>
    set({
      recognizedText: '',
      responseText: '',
      lastError: null,
    }),
}));