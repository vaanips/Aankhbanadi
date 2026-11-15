import { announcementManager } from './AnnouncementManager';
import { historyService } from './HistoryService';
import { permissionService } from './PermissionService';
import { speechRecognitionService } from './SpeechRecognitionService';
import { textToSpeechService } from './TextToSpeechService';
import { useCameraStore } from '../state/cameraStore';
import { useSettingsStore } from '../state/settingsStore';
import { useVoiceStore } from '../state/voiceStore';
import type { Intent } from '../types/voice.types';
import { parseIntent } from '../../domain/assistant/IntentParser';
import { generateSceneResponse } from '../../domain/assistant/ResponseGenerator';
import { detectionProvider } from '../../domain/detection/MockDetectionProvider';

type IntentHandler = (intent: Intent) => void;

class VoiceAssistantService {
  async listen(onIntent: IntentHandler, onMessage: (message: string) => void): Promise<void> {
    const permission = await permissionService.request('microphone');
    if (permission !== 'granted') {
      const notice =
        permission === 'blocked'
          ? 'Microphone access is blocked. Open app settings to allow it.'
          : 'Microphone access was not granted.';
      onMessage(notice);
      await this.speak(notice);
      return;
    }

    announcementManager.clear();
    useVoiceStore.getState().setRecognizedText('');
    useVoiceStore.getState().setAssistantState('LISTENING');
    onMessage('Listening. Ask a question or say a supported command.');
    try {
      await speechRecognitionService.start({
        onResult: text => {
          useVoiceStore.getState().setRecognizedText(text);
          void this.process(text, onIntent);
        },
        onError: message => {
          useVoiceStore.getState().setAssistantState('ERROR');
          onMessage(message);
        },
        onEnd: () => {
          if (useVoiceStore.getState().assistantState === 'LISTENING') {
            useVoiceStore.getState().setAssistantState('IDLE');
          }
        },
      });
    } catch (error) {
      useVoiceStore.getState().setAssistantState('ERROR');
      const message = 'Speech recognition could not start. Please try again.';
      onMessage(message);
      console.error('Speech recognition start failed:', error);
    }
  }

  async stopListening(): Promise<void> {
    await speechRecognitionService.stop();
    if (useVoiceStore.getState().assistantState === 'LISTENING') {
      useVoiceStore.getState().setAssistantState('IDLE');
    }
  }

  async speak(text: string): Promise<void> {
    const voice = useVoiceStore.getState();
    voice.setCurrentResponse(text);
    voice.setAssistantState('SPEAKING');
    try {
      await textToSpeechService.speak(text);
    } catch (error) {
      voice.setAssistantState('ERROR');
      console.error('Text-to-speech playback failed:', error);
      throw error;
    } finally {
      if (useVoiceStore.getState().assistantState === 'SPEAKING') {
        useVoiceStore.getState().setAssistantState('IDLE');
      }
    }
  }

  async process(text: string, onIntent: IntentHandler): Promise<void> {
    const voice = useVoiceStore.getState();
    voice.setAssistantState('PROCESSING');
    const intent = parseIntent(text);
    let response: string | undefined;

    switch (intent.type) {
      case 'query': {
        const cameraActive = useCameraStore.getState().status === 'CAMERA_ACTIVE';
        const detections = cameraActive ? await detectionProvider.getCurrentDetections() : [];
        response = generateSceneResponse(text, detections, cameraActive);
        break;
      }
      case 'enable-announcements':
        useVoiceStore.getState().setAnnouncementsEnabled(true);
        useSettingsStore.getState().updateSettings({ automaticAnnouncements: true });
        response = 'Automatic announcements enabled.';
        break;
      case 'disable-announcements':
        useVoiceStore.getState().setAnnouncementsEnabled(false);
        useSettingsStore.getState().updateSettings({ automaticAnnouncements: false });
        response = 'Automatic announcements paused.';
        break;
      case 'help':
        response = 'You can ask about the demonstration scene, open camera assistance, stop announcements, or open settings.';
        break;
      case 'unknown':
        response = 'I did not understand that request. Say Help to hear supported commands.';
        break;
      case 'repeat-response':
        response = voice.currentResponse || 'There is no response to repeat yet.';
        break;
      default:
        onIntent(intent);
        response =
          intent.type === 'stop-camera'
            ? 'Camera assistance stopped.'
            : intent.type === 'open-camera'
              ? 'Opening camera assistance. Start the camera when you are ready.'
              : intent.type === 'open-settings'
                ? 'Opening accessibility settings.'
                : 'Returning to the home screen.';
        break;
    }

    if (response) {
      useVoiceStore.getState().setCurrentResponse(response);
      try {
        await historyService.add(
          intent.type === 'query' ? 'question' : 'system',
          `${text} — ${response}`,
        );
      } catch (error) {
        console.error('Could not save assistant activity:', error);
      }
      await this.speak(response);
    } else {
      useVoiceStore.getState().setAssistantState('IDLE');
    }
  }

  async announceStartup(): Promise<void> {
    try {
      await textToSpeechService.initialize();
      announcementManager.enqueue('Welcome to Drishti. Your vision assistant is starting.', 2);
      announcementManager.enqueue(
        'Drishti is ready. You can start camera assistance, ask a question, or explore the available features.',
        1,
      );
    } catch (error) {
      console.error('Text-to-speech initialization failed:', error);
    }
  }
}

export const voiceAssistantService = new VoiceAssistantService();
