import { useCallback, useRef } from 'react';
import { VoiceAssistantService } from '../core/services/VoiceAssistantService';
import { useSettingsStore } from '../core/state/settingsStore';
import { useVoiceStore } from '../core/state/voiceStore';

export interface UseVoicePushToTalkResult {
  isListening: boolean;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  cancelListening: () => void;
  toggleListening: () => Promise<void>;
  onPressIn: () => void;
  onPressOut: () => void;
}

export function useVoicePushToTalk(): UseVoicePushToTalkResult {
  const pushToTalk = useSettingsStore(state => state.pushToTalk);
  const voiceState = useVoiceStore(state => state.state);
  const togglingRef = useRef(false);

  const isListening = voiceState === 'LISTENING';

  const startListening = useCallback(async () => {
    await VoiceAssistantService.startPushToTalk();
  }, []);

  const stopListening = useCallback(async () => {
    await VoiceAssistantService.stopPushToTalk();
  }, []);

  const cancelListening = useCallback(() => {
    VoiceAssistantService.reset();
  }, []);

  const toggleListening = useCallback(async () => {
    if (togglingRef.current) {
      return;
    }
    togglingRef.current = true;
    try {
      if (isListening) {
        await stopListening();
      } else {
        await startListening();
      }
    } finally {
      togglingRef.current = false;
    }
  }, [isListening, startListening, stopListening]);

  const onPressIn = useCallback(() => {
    if (pushToTalk) {
      void startListening();
    }
  }, [pushToTalk, startListening]);

  const onPressOut = useCallback(() => {
    if (pushToTalk) {
      void stopListening();
    }
  }, [pushToTalk, stopListening]);

  return {
    isListening,
    startListening,
    stopListening,
    cancelListening,
    toggleListening,
    onPressIn,
    onPressOut,
  };
}