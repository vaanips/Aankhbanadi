import { SpeechPriority, SpeechRequest, SPEECH_PRIORITY_ORDER } from '../types/voice.types';
import { createLogger } from '../utils/logger';

const log = createLogger('TextToSpeechService');

export function normalizeSpeechText(text: string): string {
  return text.replace(/\bu\s*d\s*i\s*d\b/gi, 'U. D. I. D.');
}

type TtsModule = {
  getInitStatus: () => Promise<boolean>;
  setDefaultLanguage: (lang: string) => Promise<string | void>;
  setDefaultRate: (rate: number, skipTransform?: boolean) => Promise<string | void>;
  setDefaultPitch: (pitch: number) => Promise<string | void>;
  setDucking?: (enabled: boolean) => Promise<string | void>;
  speak: (text: string, options?: object) => Promise<string | number | void>;
  stop: (onWordBoundary?: boolean) => Promise<string | void>;
  addEventListener: (event: string, handler: (...args: unknown[]) => void) => { remove?: () => void } | void;
  removeEventListener: (event: string, handler: (...args: unknown[]) => void) => void;
  requestInstallEngine?: () => Promise<unknown>;
};

class TextToSpeechServiceImpl {
  private static instance: TextToSpeechServiceImpl | null = null;
  private tts: TtsModule | null = null;
  private initialized = false;
  private initPromise: Promise<boolean> | null = null;
  private queue: SpeechRequest[] = [];
  private speaking = false;
  private rate = 0.5;
  private volume = 1.0;
  private currentSpeech: SpeechRequest | null = null;
  private onFinishBound: (() => void) | null = null;
  private onCancelBound: (() => void) | null = null;

  static getInstance(): TextToSpeechServiceImpl {
    if (!TextToSpeechServiceImpl.instance) {
      TextToSpeechServiceImpl.instance = new TextToSpeechServiceImpl();
    }
    return TextToSpeechServiceImpl.instance;
  }

  async init(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInit();
    const ok = await this.initPromise;
    this.initPromise = null;
    return ok;
  }

  private async doInit(): Promise<boolean> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const module = require('react-native-tts');
      this.tts = (module.default ?? module) as TtsModule;

      // Android rejects speak/setLanguage until the engine finishes bootstrapping.
      for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
          await this.tts.getInitStatus();
          break;
        } catch (error) {
          log.warn(`TTS getInitStatus attempt ${attempt + 1}`, error);
          await new Promise(resolve => setTimeout(resolve, 250));
        }
      }

      try {
        await Promise.resolve(this.tts.setDefaultLanguage('en-US'));
      } catch (error) {
        log.warn('setDefaultLanguage failed, continuing', error);
      }
      try {
        await Promise.resolve(this.tts.setDefaultRate(this.rate));
      } catch (error) {
        log.warn('setDefaultRate failed, continuing', error);
      }
      try {
        await Promise.resolve(this.tts.setDefaultPitch(1.0));
      } catch {
        // optional
      }
      try {
        await Promise.resolve(this.tts.setDucking?.(true));
      } catch {
        // optional
      }

      this.onFinishBound = () => this.handleUtteranceComplete();
      this.onCancelBound = () => this.handleUtteranceCancelled();
      this.tts.addEventListener('tts-finish', this.onFinishBound);
      this.tts.addEventListener('tts-cancel', this.onCancelBound);
      this.initialized = true;
      log.info('TTS initialized');
      return true;
    } catch (error) {
      log.error('TTS init failed — speech disabled', error);
      this.initialized = false;
      this.tts = null;
      return false;
    }
  }

  isAvailable(): boolean {
    return this.initialized && this.tts !== null;
  }

  async setRate(rate: number): Promise<void> {
    this.rate = Math.min(1, Math.max(0.1, rate));
    if (this.tts) {
      try {
        await Promise.resolve(this.tts.setDefaultRate(this.rate));
      } catch (error) {
        log.warn('setRate failed', error);
      }
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
  }

  async speak(
    text: string,
    priority: SpeechPriority = 'normal',
    callbacks?: {
      onDone?: () => void;
      onError?: (e: Error) => void;
      onCancel?: () => void;
    },
  ): Promise<string> {
    const id = `speech-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const request: SpeechRequest = {
      id,
      text: normalizeSpeechText(text.trim()),
      priority,
      createdAt: Date.now(),
      interruptible: priority !== 'critical',
      onDone: callbacks?.onDone,
      onError: callbacks?.onError,
      onCancel: callbacks?.onCancel,
    };

    if (!request.text) {
      callbacks?.onDone?.();
      return id;
    }

    const ok = await this.init();
    if (!ok || !this.tts) {
      const err = new Error('Text-to-speech is not available');
      callbacks?.onError?.(err);
      callbacks?.onDone?.();
      return id;
    }

    if (priority === 'critical' || priority === 'high') {
      const retained: SpeechRequest[] = [];
      this.queue.forEach(queuedRequest => {
        if (queuedRequest.priority === 'critical') {
          retained.push(queuedRequest);
        } else {
          queuedRequest.onCancel?.();
        }
      });
      this.queue = retained;
    }

    this.queue.push(request);
    this.queue.sort(
      (a, b) =>
        SPEECH_PRIORITY_ORDER[b.priority] - SPEECH_PRIORITY_ORDER[a.priority] ||
        a.createdAt - b.createdAt,
    );

    void this.processQueue();
    return id;
  }

  async stop(_interrupt = true): Promise<void> {
    const queued = this.queue;
    this.queue = [];
    const active = this.currentSpeech;
    this.currentSpeech = null;
    this.speaking = true;
    active?.onCancel?.();
    queued.forEach(request => request.onCancel?.());
    if (this.tts) {
      try {
        // Android stop() takes no args; iOS accepts optional boundary flag.
        await Promise.resolve(this.tts.stop());
      } catch (error) {
        log.warn('stop failed', error);
      }
    }
    this.speaking = false;
    void this.processQueue();
  }

  async cancel(id: string): Promise<void> {
    const queuedIndex = this.queue.findIndex(request => request.id === id);
    if (queuedIndex >= 0) {
      const [cancelled] = this.queue.splice(queuedIndex, 1);
      cancelled?.onCancel?.();
      return;
    }

    const active = this.currentSpeech;
    if (!active || active.id !== id) {
      return;
    }

    this.speaking = true;
    this.currentSpeech = null;
    active.onCancel?.();
    if (this.tts) {
      try {
        await Promise.resolve(this.tts.stop());
      } catch (error) {
        log.warn('cancel failed', error);
      }
    }
    this.speaking = false;
    void this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.speaking || !this.tts || this.queue.length === 0) {
      return;
    }
    const next = this.queue.shift();
    if (!next) {
      return;
    }
    this.speaking = true;
    this.currentSpeech = next;
    try {
      if (this.volume <= 0) {
        this.handleUtteranceComplete();
        return;
      }
      await Promise.resolve(this.tts.speak(next.text));
      // Safety: if finish event never fires, unblock the queue.
      setTimeout(() => {
        if (this.currentSpeech?.id === next.id) {
          this.handleUtteranceComplete();
        }
      }, Math.max(4000, next.text.length * 80));
    } catch (error) {
      log.error('speak failed', error);
      next.onError?.(error instanceof Error ? error : new Error(String(error)));
      this.speaking = false;
      this.currentSpeech = null;
      next.onDone?.();
      void this.processQueue();
    }
  }

  private handleUtteranceComplete(): void {
    const finished = this.currentSpeech;
    if (!finished) {
      return;
    }
    this.currentSpeech = null;
    this.speaking = false;
    finished.onDone?.();
    void this.processQueue();
  }

  private handleUtteranceCancelled(): void {
    const cancelled = this.currentSpeech;
    if (!cancelled) {
      return;
    }
    this.currentSpeech = null;
    this.speaking = false;
    cancelled.onCancel?.();
    void this.processQueue();
  }
}

export const TextToSpeechService = TextToSpeechServiceImpl.getInstance();
