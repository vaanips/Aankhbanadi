import Voice from '@react-native-voice/voice';

type RecognitionCallbacks = {
  onResult: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
};

class SpeechRecognitionService {
  private callbacks?: RecognitionCallbacks;

  constructor() {
    Voice.onSpeechResults = event => {
      const text = event.value?.[0];
      if (text) this.callbacks?.onResult(text);
    };
    Voice.onSpeechError = event => {
      this.callbacks?.onError(event.error?.message ?? 'Speech recognition failed.');
    };
    Voice.onSpeechEnd = () => this.callbacks?.onEnd();
  }

  async start(callbacks: RecognitionCallbacks): Promise<void> {
    this.callbacks = callbacks;
    await Voice.start('en-US');
  }

  async stop(): Promise<void> {
    await Voice.stop();
  }

  async cancel(): Promise<void> {
    await Voice.cancel();
    this.callbacks = undefined;
  }

  async destroy(): Promise<void> {
    await Voice.destroy();
    Voice.removeAllListeners();
    this.callbacks = undefined;
  }
}

export const speechRecognitionService = new SpeechRecognitionService();
