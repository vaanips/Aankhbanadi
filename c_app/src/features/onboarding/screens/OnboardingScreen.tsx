import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../../components/layout/Screen';
import { AppText } from '../../../components/typography/AppText';
import { PrimaryButton } from '../../../components/buttons/PrimaryButton';
import { SecondaryButton } from '../../../components/buttons/SecondaryButton';
import { useAppStore } from '../../../core/state/appStore';
import { TextToSpeechService } from '../../../core/services/TextToSpeechService';
import { StorageService } from '../../../core/services/StorageService';
import { APP_NAME, STORAGE_KEYS } from '../../../core/utils/constants';
import { RootStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const SLIDES = [
  {
    title: `Welcome to ${APP_NAME}`,
    body: 'Drishti helps you understand your surroundings with voice-first camera assistance and scene descriptions.',
  },
  {
    title: 'Camera & scene awareness',
    body: 'Start the camera to hear what is around you. In demo mode, sample data stands in for live detection.',
  },
  {
    title: 'Ask by voice',
    body: 'Use the Ask tab or say commands like “what can you see” or “is there a person nearby”.',
  },
  {
    title: 'You are in control',
    body: 'Adjust speech, text size, and haptics in Settings. Say “help” anytime for commands.',
  },
] as const;

export function OnboardingScreen({ navigation }: Props): React.JSX.Element {
  const [index, setIndex] = useState(0);
  const welcomeSpoken = useRef(false);
  const setOnboardingComplete = useAppStore(state => state.setOnboardingComplete);

  const finishOnboarding = useCallback(async () => {
    setOnboardingComplete(true);
    try {
      await StorageService.set(STORAGE_KEYS.onboardingComplete, true);
    } catch {
      // State is still updated locally.
    }
    navigation.replace('Main');
  }, [navigation, setOnboardingComplete]);

  useEffect(() => {
    if (index !== 0 || welcomeSpoken.current) {
      return;
    }
    welcomeSpoken.current = true;
    void TextToSpeechService.speak(
      `Welcome to ${APP_NAME}. I am your personal vision assistant. Press the microphone button when you want to ask me something. You can say Start to enable automatic announcements and Stop to pause them.`,
      'high',
    );
  }, [index]);

  const slide = SLIDES[index];
  const isLast = index >= SLIDES.length - 1;

  return (
    <Screen scroll accessibilityLabel="Onboarding">
      <View style={styles.content}>
        <AppText variant="caption" color="secondary" style={styles.step}>
          Step {index + 1} of {SLIDES.length}
        </AppText>
        <AppText variant="title" style={styles.title}>
          {slide.title}
        </AppText>
        <AppText variant="body" color="secondary" style={styles.body}>
          {slide.body}
        </AppText>
        <View style={styles.actions}>
          <SecondaryButton
            label="Skip"
            onPress={() => void finishOnboarding()}
            accessibilityHint="Skip onboarding and open the main app"
          />
          {!isLast ? (
            <PrimaryButton label="Next" onPress={() => setIndex(i => i + 1)} />
          ) : (
            <PrimaryButton label="Get started" onPress={() => void finishOnboarding()} />
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 24,
    gap: 16,
  },
  step: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    marginTop: 4,
  },
  body: {
    marginBottom: 8,
  },
  actions: {
    gap: 12,
    marginTop: 24,
  },
});