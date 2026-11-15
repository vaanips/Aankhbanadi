import { TextToSpeechService } from '../../core/services/TextToSpeechService';
import { AudioSessionService } from '../../core/services/AudioSessionService';
import { useSettingsStore } from '../../core/state/settingsStore';
import { useVoiceStore } from '../../core/state/voiceStore';
import { createLogger } from '../../core/utils/logger';
import { SpeechPriority } from '../../core/types/voice.types';
import { AnnouncementQueue, AnnouncementItem } from './AnnouncementQueue';

const log = createLogger('AnnouncementManager');

export class AnnouncementManager {
  private queue = new AnnouncementQueue();
  private processing = false;
  private enabled = true;
  private paused = false;
  private lastSpokenKey: string | null = null;

  enable(): void {
    this.enabled = true;
    useVoiceStore.getState().setAnnouncementsEnabled(true);
  }

  disable(): void {
    this.enabled = false;
    this.queue.clear();
    useVoiceStore.getState().setAnnouncementsEnabled(false);
    void TextToSpeechService.stop(true);
  }

  pause(): void {
    this.paused = true;
    useVoiceStore.getState().setAnnouncementsPaused(true);
    this.queue.clearLowPriority();
  }

  resume(): void {
    this.paused = false;
    useVoiceStore.getState().setAnnouncementsPaused(false);
    void this.pump();
  }

  pauseWhileListening(): void {
    if (AudioSessionService.areAnnouncementsPausedForListening()) {
      this.pause();
    }
  }

  resumeAfterListening(): void {
    if (!AudioSessionService.areAnnouncementsPausedForListening() && this.enabled) {
      this.resume();
    }
  }

  announce(
    text: string,
    priority: SpeechPriority = 'normal',
    dedupeKey?: string,
  ): boolean {
    if (!this.enabled || !useSettingsStore.getState().voiceEnabled) {
      return false;
    }
    if (this.paused || AudioSessionService.areAnnouncementsPausedForListening()) {
      return false;
    }
    const item = this.queue.enqueue(text, priority, dedupeKey);
    if (!item) {
      return false;
    }
    void this.pump();
    return true;
  }

  clear(): void {
    this.queue.clear();
    this.processing = false;
    this.lastSpokenKey = null;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isPaused(): boolean {
    return this.paused;
  }

  private async pump(): Promise<void> {
    if (this.processing || !this.enabled || this.paused) {
      return;
    }
    if (AudioSessionService.areAnnouncementsPausedForListening()) {
      return;
    }

    const item = this.queue.peek();
    if (!item) {
      return;
    }

    const key = item.dedupeKey ?? item.text.toLowerCase();
    if (key === this.lastSpokenKey) {
      this.queue.dequeue();
      void this.pump();
      return;
    }

    this.processing = true;
    this.queue.dequeue();

    try {
      const rate = useSettingsStore.getState().speechRate;
      const volume = useSettingsStore.getState().speechVolume;
      await TextToSpeechService.setRate(rate);
      TextToSpeechService.setVolume(volume);
      await TextToSpeechService.speak(item.text, item.priority, {
        onDone: () => {
          this.lastSpokenKey = key;
          this.processing = false;
          void this.pump();
        },
        onError: error => {
          log.warn('Announcement TTS error', error);
          this.processing = false;
          void this.pump();
        },
      });
    } catch (error) {
      log.error('Failed to speak announcement', error);
      this.processing = false;
      void this.pump();
    }
  }

  handleDetectionAnnouncement(text: string, dedupeKey: string): void {
    this.announce(text, 'low', dedupeKey);
  }

  getPending(): AnnouncementItem[] {
    return this.queue.snapshot();
  }
}

export const announcementManager = new AnnouncementManager();