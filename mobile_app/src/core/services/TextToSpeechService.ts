import Tts from 'react-native-tts';

class TextToSpeechService {
  private initialization?: Promise<void>;
  private speaking = false;
  private completion?: () => void;

  initialize(): Promise<void> {
    if (!this.initialization) {
      this.initialization = Tts.getInitStatus()
        .then(() => {
          Tts.setDefaultLanguage('en-US');
          Tts.addEventListener('tts-finish', this.handleFinish);
          Tts.addEventListener('tts-cancel', this.handleFinish);
          Tts.addEventListener('tts-error', this.handleFinish);
        })
        .catch(error => {
          this.initialization = undefined;
          throw error;
        });
    }
    return this.initialization;
  }

  async speak(text: string): Promise<void> {
    await this.initialize();
    await this.stop();
    this.speaking = true;
    return new Promise((resolve, reject) => {
      this.completion = resolve;
      try {
        Tts.speak(text);
      } catch (error) {
        this.speaking = false;
        this.completion = undefined;
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    this.speaking = false;
    Tts.stop();
    this.finishCurrent();
  }

  isSpeaking(): boolean {
    return this.speaking;
  }

  setRate(rate: number): void {
    Tts.setDefaultRate(rate);
  }

  setVolume(volume: number): void {
    Tts.setDefaultVolume(volume);
  }

  private readonly handleFinish = (): void => {
    this.speaking = false;
    this.finishCurrent();
  };

  private finishCurrent(): void {
    const complete = this.completion;
    this.completion = undefined;
    complete?.();
  }
}

export const textToSpeechService = new TextToSpeechService();
