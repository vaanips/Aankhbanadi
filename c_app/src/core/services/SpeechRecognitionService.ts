import { VOICE_LISTEN_TIMEOUT_MS } from '../utils/constants';
import { createLogger } from '../utils/logger';

const log = createLogger('SpeechRecognitionService');

type VoiceModule = {
  isAvailable?: () => Promise<boolean>;
  start: (locale?: string, options?: object) => Promise<void>;
  stop: () => Promise<void>;
  cancel: () => Promise<void>;
  destroy?: () => Promise<void>;
  removeAllListeners?: () => void;
  isRecognizing?: () => Promise<boolean>;
  onSpeechStart?: (e: unknown) => void;
  onSpeechEnd?: (e: unknown) => void;
  onSpeechResults?: (e: { value?: string[] }) => void;
  onSpeechPartialResults?: (e: { value?: string[] }) => void;
  onSpeechError?: (e: { error?: { message?: string; code?: string } }) => void;
};

function isBenignStopError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /\b5\b/.test(message) ||
    /\b11\b/.test(message) ||
    /client side error/i.test(message) ||
    /didn't understand/i.test(message) ||
    /didnt understand/i.test(message) ||
    /no match/i.test(message) ||
    /no speech/i.test(message) ||
    /7\//.test(message)
  );
}

class SpeechRecognitionServiceImpl {
  private voice: VoiceModule | null = null;
  private loadFailed = false;
  private activePromise: {
    resolve: (text: string) => void;
    reject: (error: Error) => void;
  } | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private endSettleId: ReturnType<typeof setTimeout> | null = null;
  private lastPartial = '';
  private lastFinal = '';
  private listening = false;

  private ensureVoice(): VoiceModule | null {
    if (this.loadFailed) {
      return null;
    }
    if (this.voice) {
      return this.voice;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const module = require('@react-native-voice/voice');
      this.voice = (module.default ?? module) as VoiceModule;
      return this.voice;
    } catch (error) {
      this.loadFailed = true;
      log.error('Voice module unavailable', error);
      return null;
    }
  }

  isAvailable(): boolean {
    return !this.loadFailed && this.ensureVoice() !== null;
  }

  private attachListeners(): void {
    const voice = this.voice;
    if (!voice) {
      return;
    }
    voice.onSpeechPartialResults = e => {
      const text = (e.value?.[0] ?? '').trim();
      if (text) {
        this.lastPartial = text;
      }
    };
    voice.onSpeechResults = e => {
      const text = (e.value?.[0] ?? '').trim();
      if (text) {
        this.lastFinal = text;
        this.lastPartial = text;
        // Short commands ("start"/"stop") often arrive as final results —
        // settle briefly so we don't race with a following empty end/error.
        if (this.activePromise && this.listening) {
          this.scheduleFinish(text, 250);
        }
      }
    };
    voice.onSpeechError = e => {
      const message = e.error?.message ?? 'Speech recognition error';
      if (isBenignStopError(message) || /no speech/i.test(message)) {
        this.scheduleFinish(this.lastFinal || this.lastPartial || '', 150);
        return;
      }
      this.finishWithError(new Error(message));
    };
    voice.onSpeechEnd = () => {
      // Android often fires end BEFORE final results. Wait for late results.
      this.scheduleFinish(this.lastFinal || this.lastPartial || '', 450);
    };
  }

  private clearTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.endSettleId) {
      clearTimeout(this.endSettleId);
      this.endSettleId = null;
    }
  }

  private scheduleFinish(fallbackText: string, delayMs: number): void {
    if (!this.activePromise) {
      return;
    }
    if (this.endSettleId) {
      clearTimeout(this.endSettleId);
    }
    this.endSettleId = setTimeout(() => {
      this.endSettleId = null;
      const text = (this.lastFinal || this.lastPartial || fallbackText || '').trim();
      this.finish(text);
    }, delayMs);
  }

  private finish(text: string): void {
    if (!this.activePromise) {
      return;
    }
    this.clearTimeout();
    const promise = this.activePromise;
    this.activePromise = null;
    this.listening = false;
    void this.safeStop();
    promise.resolve(text);
  }

  private finishWithError(error: Error): void {
    if (!this.activePromise) {
      return;
    }
    this.clearTimeout();
    const promise = this.activePromise;
    this.activePromise = null;
    this.listening = false;
    void this.safeStop();
    promise.reject(error);
  }

  private async safeStop(): Promise<void> {
    const voice = this.voice;
    if (!voice) {
      return;
    }
    try {
      await voice.stop();
    } catch (error) {
      if (!isBenignStopError(error)) {
        log.warn('stop failed', error);
      }
    }
  }

  async beginListening(locale = 'en-US'): Promise<void> {
    const voice = this.ensureVoice();
    if (!voice) {
      throw new Error('Speech recognition is not available');
    }
    if (this.activePromise) {
      await this.cancel();
    }
    this.lastPartial = '';
    this.lastFinal = '';
    this.attachListeners();

    try {
      const available = await voice.isAvailable?.();
      if (available === false) {
        throw new Error('Speech recognition service is not available on this device');
      }
    } catch (error) {
      if (error instanceof Error && /not available/i.test(error.message)) {
        throw error;
      }
    }

    this.listening = true;
    try {
      await voice.start(locale, {
        EXTRA_LANGUAGE_MODEL: 'LANGUAGE_MODEL_FREE_FORM',
        EXTRA_PARTIAL_RESULTS: true,
        REQUEST_PERMISSIONS_AUTO: true,
      });
    } catch (error) {
      this.listening = false;
      log.error('beginListening failed', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Start listening and resolve when speech ends, results arrive, or timeout.
   * Matches blind_v1 "press M once" behaviour.
   */
  async listenOnce(locale = 'en-US', timeoutMs = VOICE_LISTEN_TIMEOUT_MS): Promise<string> {
    const voice = this.ensureVoice();
    if (!voice) {
      throw new Error('Speech recognition is not available');
    }
    if (this.activePromise) {
      await this.cancel();
    }

    this.lastPartial = '';
    this.lastFinal = '';
    this.attachListeners();
    this.listening = true;

    return new Promise<string>((resolve, reject) => {
      this.activePromise = { resolve, reject };
      this.timeoutId = setTimeout(() => {
        log.warn('Listen timeout — using partial transcript');
        this.finish(this.lastFinal || this.lastPartial || '');
      }, timeoutMs);

      voice
        .start(locale, {
          EXTRA_LANGUAGE_MODEL: 'LANGUAGE_MODEL_FREE_FORM',
          EXTRA_PARTIAL_RESULTS: true,
          REQUEST_PERMISSIONS_AUTO: true,
        })
        .catch(error => {
          if (isBenignStopError(error)) {
            this.finish(this.lastFinal || this.lastPartial || '');
            return;
          }
          this.finishWithError(
            error instanceof Error ? error : new Error(String(error)),
          );
        });
    });
  }

  async finalizeListening(): Promise<string> {
    if (!this.voice) {
      return this.lastFinal || this.lastPartial || '';
    }

    if (!this.activePromise) {
      // Already finished via results/end — return last transcript.
      await this.safeStop();
      return this.lastFinal || this.lastPartial || '';
    }

    return new Promise<string>((resolve, reject) => {
      // Rebind so stop-triggered end/error resolves cleanly.
      const previous = this.activePromise;
      this.activePromise = {
        resolve: text => {
          previous?.resolve(text);
          resolve(text);
        },
        reject: err => {
          previous?.reject(err);
          reject(err);
        },
      };

      this.timeoutId = setTimeout(() => {
        this.finish(this.lastFinal || this.lastPartial || '');
      }, 2500);

      this.safeStop().catch(() => {
        this.finish(this.lastFinal || this.lastPartial || '');
      });
    });
  }

  async start(locale = 'en-US'): Promise<string> {
    return this.listenOnce(locale);
  }

  async stop(): Promise<void> {
    await this.safeStop();
  }

  async cancel(): Promise<void> {
    this.clearTimeout();
    const voice = this.voice;
    if (voice) {
      try {
        await voice.cancel();
      } catch (error) {
        if (!isBenignStopError(error)) {
          log.warn('cancel failed', error);
        }
      }
    }
    const promise = this.activePromise;
    this.activePromise = null;
    this.listening = false;
    promise?.resolve(this.lastFinal || this.lastPartial || '');
  }

  async cleanup(): Promise<void> {
    const voice = this.voice;
    if (!voice) {
      return;
    }
    try {
      voice.removeAllListeners?.();
      await voice.destroy?.();
    } catch (error) {
      log.warn('cleanup failed', error);
    }
  }
}

export const SpeechRecognitionService = new SpeechRecognitionServiceImpl();
