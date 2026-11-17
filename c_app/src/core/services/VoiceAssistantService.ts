import { VoiceAssistantState } from '../types/voice.types';
import { TextToSpeechService } from './TextToSpeechService';
import { SpeechRecognitionService } from './SpeechRecognitionService';
import { AudioSessionService } from './AudioSessionService';
import { announcementManager } from '../../domain/announcements/AnnouncementManager';
import { createLogger } from '../utils/logger';

const log = createLogger('VoiceAssistantService');
const LISTEN_WINDOW_MS = 7000;

type StateListener = (state: VoiceAssistantState) => void;

const VALID_TRANSITIONS: Record<VoiceAssistantState, VoiceAssistantState[]> = {
  IDLE: ['LISTENING', 'SPEAKING', 'ERROR'],
  LISTENING: ['PROCESSING', 'IDLE', 'ERROR'],
  PROCESSING: ['SPEAKING', 'IDLE', 'ERROR'],
  SPEAKING: ['IDLE', 'LISTENING', 'PAUSED', 'ERROR'],
  PAUSED: ['IDLE', 'SPEAKING', 'LISTENING'],
  ERROR: ['IDLE'],
};

class VoiceAssistantServiceImpl {
  private state: VoiceAssistantState = 'IDLE';
  private listeners = new Set<StateListener>();
  private pushToTalkActive = false;
  private utteranceHandler: ((text: string) => Promise<void>) | null = null;
  private sessionToken = 0;

  getState(): VoiceAssistantState {
    return this.state;
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  setUtteranceHandler(handler: (text: string) => Promise<void>): void {
    this.utteranceHandler = handler;
  }

  private transition(next: VoiceAssistantState): boolean {
    const allowed = VALID_TRANSITIONS[this.state];
    if (!allowed.includes(next)) {
      log.warn(`Invalid transition ${this.state} -> ${next}`);
      return false;
    }
    this.state = next;
    this.listeners.forEach(l => l(this.state));
    return true;
  }

  private forceIdle(): void {
    this.pushToTalkActive = false;
    this.state = 'IDLE';
    this.listeners.forEach(l => l(this.state));
    AudioSessionService.resumeAnnouncementsAfterListening();
    announcementManager.resumeAfterListening();
  }

  /**
   * Tap once → listen ~7s (like blind_v1 M key), then answer.
   * Second tap while listening cancels/finalizes early.
   */
  async startPushToTalk(): Promise<void> {
    if (this.pushToTalkActive || this.state === 'LISTENING') {
      await this.stopPushToTalk();
      return;
    }

    this.pushToTalkActive = true;
    const token = ++this.sessionToken;

    AudioSessionService.pauseAnnouncementsForListening();
    announcementManager.pauseWhileListening();
    if (!this.transition('LISTENING')) {
      this.forceIdle();
      return;
    }

    await TextToSpeechService.stop();

    try {
      const listenPromise = SpeechRecognitionService.listenOnce('en-US', LISTEN_WINDOW_MS);
      const recognized = (await listenPromise).trim();

      if (token !== this.sessionToken) {
        return;
      }

      this.pushToTalkActive = false;
      if (!recognized) {
        this.forceIdle();
        await TextToSpeechService.speak(
          'Sorry, I could not understand. Please try again.',
          'high',
        );
        return;
      }

      this.transition('PROCESSING');
      this.transition('SPEAKING');
      await this.utteranceHandler?.(recognized);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Android 11/"Didn't understand" is a normal no-match — not a hard failure.
      if (
        /\b11\b/.test(message) ||
        /didn't understand/i.test(message) ||
        /didnt understand/i.test(message) ||
        /no match/i.test(message)
      ) {
        log.warn('listen no-match', message);
        await TextToSpeechService.speak(
          'Sorry, I could not understand. Please try again.',
          'high',
        );
      } else {
        log.warn('listen session failed', error);
        await TextToSpeechService.speak(
          'Microphone unavailable. Please check microphone access.',
          'high',
        );
      }
    } finally {
      if (token === this.sessionToken) {
        this.forceIdle();
      }
    }
  }

  async stopPushToTalk(): Promise<void> {
    if (!this.pushToTalkActive && this.state !== 'LISTENING') {
      return;
    }
    this.sessionToken += 1;
    this.pushToTalkActive = false;
    try {
      const text = await SpeechRecognitionService.finalizeListening();
      if (text.trim() && this.utteranceHandler) {
        this.transition('PROCESSING');
        this.transition('SPEAKING');
        await this.utteranceHandler(text.trim());
      }
    } catch (error) {
      log.warn('Early stop recognition', error);
    } finally {
      this.forceIdle();
    }
  }

  async speakResponse(text: string): Promise<void> {
    if (!text.trim()) {
      this.forceIdle();
      return;
    }
    this.transition('SPEAKING');
    await TextToSpeechService.speak(text, 'high', {
      onDone: () => this.forceIdle(),
      onError: () => this.forceIdle(),
    });
  }

  reset(): void {
    this.sessionToken += 1;
    this.pushToTalkActive = false;
    void SpeechRecognitionService.cancel();
    void TextToSpeechService.stop();
    this.state = 'IDLE';
    this.listeners.forEach(l => l(this.state));
  }
}

export const VoiceAssistantService = new VoiceAssistantServiceImpl();
