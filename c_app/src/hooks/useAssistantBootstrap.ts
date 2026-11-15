import { useEffect } from 'react';
import {
  AssistantController,
  AssistantNavigationCallbacks,
} from '../domain/assistant/AssistantController';
import { appDetectionProvider } from '../domain/detection/detectionRuntime';
import { announcementManager } from '../domain/announcements/AnnouncementManager';
import { VoiceAssistantService } from '../core/services/VoiceAssistantService';
import { useVoiceStore } from '../core/state/voiceStore';

let navigationCallbacks: AssistantNavigationCallbacks = {};

const navigationProxy: AssistantNavigationCallbacks = {
  onNavigateHome: () => navigationCallbacks.onNavigateHome?.(),
  onNavigateSettings: () => navigationCallbacks.onNavigateSettings?.(),
  onNavigateBack: () => navigationCallbacks.onNavigateBack?.(),
  onStartCamera: () => navigationCallbacks.onStartCamera?.(),
  onStopCamera: () => navigationCallbacks.onStopCamera?.(),
  onAnnouncementsEnable: enabled => {
    if (enabled) {
      announcementManager.enable();
    } else {
      announcementManager.disable();
    }
    navigationCallbacks.onAnnouncementsEnable?.(enabled);
  },
  onAnnouncementsPause: paused => {
    if (paused) {
      announcementManager.pause();
    } else {
      announcementManager.resume();
    }
    navigationCallbacks.onAnnouncementsPause?.(paused);
  },
};

export const assistantController = new AssistantController(appDetectionProvider, navigationProxy);

let voiceServiceBound = false;

export function bindAssistantNavigation(callbacks: AssistantNavigationCallbacks): void {
  navigationCallbacks = callbacks;
}

export function useAssistantBootstrap(callbacks?: AssistantNavigationCallbacks): void {
  useEffect(() => {
    if (callbacks) {
      bindAssistantNavigation(callbacks);
    }
  }, [callbacks]);

  useEffect(() => {
    if (voiceServiceBound) {
      return;
    }
    voiceServiceBound = true;

    const unsubVoice = VoiceAssistantService.subscribe(state => {
      useVoiceStore.getState().setState(state);
    });

    VoiceAssistantService.setUtteranceHandler(async text => {
      await assistantController.processUtterance(text);
    });

    const announcementsEnabled = useVoiceStore.getState().announcementsEnabled;
    if (announcementsEnabled) {
      announcementManager.enable();
    } else {
      announcementManager.disable();
    }

    return () => {
      unsubVoice();
    };
  }, []);
}