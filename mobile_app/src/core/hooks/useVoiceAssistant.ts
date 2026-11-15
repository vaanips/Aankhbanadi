import { useCallback, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../app/navigation/types';
import { voiceAssistantService } from '../services/VoiceAssistantService';
import type { Intent } from '../types/voice.types';

export function useVoiceAssistant() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [message, setMessage] = useState('');
  const handleIntent = useCallback(
    (intent: Intent) => {
      switch (intent.type) {
        case 'go-home':
          navigation.navigate('Tabs', { screen: 'Home' });
          break;
        case 'open-camera':
          navigation.navigate('Tabs', { screen: 'Camera' });
          break;
        case 'open-settings':
          navigation.navigate('Tabs', { screen: 'Settings' });
          break;
        case 'stop-camera':
          navigation.navigate('Tabs', { screen: 'Camera' });
          break;
        case 'help':
          navigation.navigate('Help');
          break;
      }
    },
    [navigation],
  );

  const listen = useCallback(async () => {
    await voiceAssistantService.listen(handleIntent, setMessage);
  }, [handleIntent]);

  const stopListening = useCallback(async () => {
    await voiceAssistantService.stopListening();
  }, []);

  const ask = useCallback(
    async (text: string) => {
      await voiceAssistantService.process(text, handleIntent);
    },
    [handleIntent],
  );

  const repeat = useCallback(async (text: string) => {
    if (text) await voiceAssistantService.speak(text);
  }, []);

  return { message, listen, stopListening, repeat, ask, setMessage };
}
