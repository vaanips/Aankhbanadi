import { AssistantResponse } from '../../core/types/assistant.types';
import { Detection } from '../../core/types/detection.types';
import { TextToSpeechService } from '../../core/services/TextToSpeechService';
import { useActivityStore } from '../../core/state/activityStore';
import { useVoiceStore } from '../../core/state/voiceStore';
import { useSettingsStore } from '../../core/state/settingsStore';
import { createLogger } from '../../core/utils/logger';
import { DetectionProvider } from '../detection/DetectionProvider';
import { BlindV1QueryEngine } from './BlindV1QueryEngine';

const log = createLogger('AssistantController');

export interface AssistantNavigationCallbacks {
  onNavigateHome?: () => void;
  onNavigateSettings?: () => void;
  onNavigateBack?: () => void;
  onStartCamera?: () => void;
  onStopCamera?: () => void;
  onAnnouncementsEnable?: (enabled: boolean) => void;
  onAnnouncementsPause?: (paused: boolean) => void;
}

/**
 * Voice assistant wired to blind_v1.py query logic.
 * Mic utterance → BlindV1QueryEngine → spoken answer (+ start/stop announcements).
 */
export class AssistantController {
  constructor(
    private detectionProvider: DetectionProvider,
    private navigation: AssistantNavigationCallbacks = {},
  ) {}

  async processUtterance(text: string): Promise<AssistantResponse> {
    const trimmed = text.trim();
    useVoiceStore.getState().setRecognizedText(trimmed);
    useActivityStore.getState().addEntry({
      kind: 'voice_command',
      title: 'Voice command',
      detail: trimmed,
    });

    const detections = this.getDetections();
    log.info('Voice query', { text: trimmed, detectionCount: detections.length });

    // Help shortcut (not in blind_v1, but useful on phone)
    const lower = trimmed.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (lower === 'help' || lower === 'what can you do' || lower === 'commands') {
      const spokenText = [
        'You can say start or stop for automatic announcements.',
        'Ask what is ahead, on my left, or on my right.',
        'Ask is there a person nearby, or what is within five steps.',
        'Ask about chairs, bottles, cars, and other objects around you.',
      ].join(' ');
      return this.speakAndReturn({ spokenText });
    }

    const answer = BlindV1QueryEngine.answerVoiceQuery(trimmed, detections);

    const response: AssistantResponse = {
      spokenText: answer.spokenText,
      shouldEnableAnnouncements: answer.enableAnnouncements,
      shouldDisableAnnouncements: answer.disableAnnouncements,
      shouldResumeAnnouncements: answer.enableAnnouncements,
    };

    this.applySideEffects(response);
    return this.speakAndReturn(response);
  }

  private async speakAndReturn(response: AssistantResponse): Promise<AssistantResponse> {
    useVoiceStore.getState().setResponseText(response.spokenText);
    useActivityStore.getState().addEntry({
      kind: 'assistant_response',
      title: 'Assistant response',
      detail: response.spokenText,
    });

    const voiceEnabled = useSettingsStore.getState().voiceEnabled;
    if (voiceEnabled && response.spokenText) {
      const rate = useSettingsStore.getState().speechRate;
      const volume = useSettingsStore.getState().speechVolume;
      await TextToSpeechService.setRate(rate);
      TextToSpeechService.setVolume(volume);
      await TextToSpeechService.speak(response.spokenText, 'high');
    }
    return response;
  }

  private getDetections(): Detection[] {
    return this.detectionProvider.getCurrentDetections();
  }

  private applySideEffects(response: AssistantResponse): void {
    if (response.shouldEnableAnnouncements) {
      useVoiceStore.getState().setAnnouncementsEnabled(true);
      this.navigation.onAnnouncementsEnable?.(true);
    }
    if (response.shouldDisableAnnouncements) {
      useVoiceStore.getState().setAnnouncementsEnabled(false);
      this.navigation.onAnnouncementsEnable?.(false);
    }
    if (response.shouldPauseAnnouncements) {
      useVoiceStore.getState().setAnnouncementsPaused(true);
      this.navigation.onAnnouncementsPause?.(true);
    }
    if (response.shouldResumeAnnouncements) {
      useVoiceStore.getState().setAnnouncementsPaused(false);
      this.navigation.onAnnouncementsPause?.(false);
    }
  }
}
