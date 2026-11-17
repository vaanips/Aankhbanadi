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
  private currentItem: AnnouncementItem | null = null;
  private currentSpeechId: string | null = null;
  private speechGeneration = 0;

  enable(): void {
    this.enabled = true;
    this.lastSpokenKey = null;
    useVoiceStore.getState().setAnnouncementsEnabled(true);
    void this.pump();
  }

  disable(): void {
    this.enabled = false;
    this.queue.clear();
    this.invalidateCurrentSpeech();
    this.lastSpokenKey = null;
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
    scope?: string,
  ): boolean {
    if (!this.enabled || !useSettingsStore.getState().voiceEnabled) {
      return false;
    }
    if (this.paused || AudioSessionService.areAnnouncementsPausedForListening()) {
      return false;
    }
    const item = this.queue.enqueue(text, priority, dedupeKey, scope);
    if (!item) {
      return false;
    }
    void this.pump();
    return true;
  }

  announceLatest(
    text: string,
    priority: SpeechPriority,
    dedupeKey: string,
    scope: string,
  ): boolean {
    this.queue.clearScope(scope);
    const speechId = this.invalidateCurrentSpeech(scope);
    if (speechId) {
      void TextToSpeechService.cancel(speechId);
    }
    this.lastSpokenKey = null;
    return this.announce(text, priority, dedupeKey, scope);
  }

  clearScope(scope: string): void {
    this.queue.clearScope(scope);
    const speechId = this.invalidateCurrentSpeech(scope);
    if (speechId) {
      void TextToSpeechService.cancel(speechId);
    }
    void this.pump();
  }

  clear(): void {
    this.queue.clear();
    const speechId = this.invalidateCurrentSpeech();
    if (speechId) {
      void TextToSpeechService.cancel(speechId);
    }
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
    this.currentItem = item;
    const generation = ++this.speechGeneration;

    try {
      const rate = useSettingsStore.getState().speechRate;
      const volume = useSettingsStore.getState().speechVolume;
      await TextToSpeechService.setRate(rate);
      if (generation !== this.speechGeneration) {
        return;
      }
      TextToSpeechService.setVolume(volume);
      const speechId = await TextToSpeechService.speak(item.text, item.priority, {
        onDone: () => this.finishSpeech(item, generation, key, true),
        onError: error => {
          log.warn('Announcement TTS error', error);
          this.finishSpeech(item, generation, key, false);
        },
        onCancel: () => this.finishSpeech(item, generation, key, false),
      });
      if (generation !== this.speechGeneration) {
        await TextToSpeechService.cancel(speechId);
        return;
      }
      if (this.currentItem?.id === item.id) {
        this.currentSpeechId = speechId;
      }
    } catch (error) {
      log.error('Failed to speak announcement', error);
      this.finishSpeech(item, generation, key, false);
    }
  }

  private finishSpeech(
    item: AnnouncementItem,
    generation: number,
    key: string,
    spoken: boolean,
  ): void {
    if (generation !== this.speechGeneration || this.currentItem?.id !== item.id) {
      return;
    }
    this.currentItem = null;
    this.currentSpeechId = null;
    this.processing = false;
    if (spoken) {
      this.lastSpokenKey = key;
    }
    void this.pump();
  }

  private invalidateCurrentSpeech(scope?: string): string | null {
    if (!this.currentItem || (scope && this.currentItem.scope !== scope)) {
      return null;
    }
    this.speechGeneration += 1;
    const speechId = this.currentSpeechId;
    this.currentSpeechId = null;
    this.currentItem = null;
    this.processing = false;
    return speechId;
  }

  handleDetectionAnnouncement(text: string, dedupeKey: string): void {
    this.announce(text, 'low', dedupeKey);
  }

  getPending(): AnnouncementItem[] {
    return this.queue.snapshot();
  }
}

export const announcementManager = new AnnouncementManager();