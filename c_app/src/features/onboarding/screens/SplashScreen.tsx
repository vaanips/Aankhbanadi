import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../../components/layout/Screen';
import { AppText } from '../../../components/typography/AppText';
import { LoadingIndicator } from '../../../components/feedback/LoadingIndicator';
import { useAppStore } from '../../../core/state/appStore';
import { useSettingsStore } from '../../../core/state/settingsStore';
import { useActivityStore } from '../../../core/state/activityStore';
import { TextToSpeechService } from '../../../core/services/TextToSpeechService';
import { StorageService } from '../../../core/services/StorageService';
import { APP_NAME, STORAGE_KEYS } from '../../../core/utils/constants';
import { RootStackParamList } from '../../../app/navigation/types';
import { useTheme } from '../../../theme/ThemeProvider';

const TAGLINE = 'See Beyond Vision.';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export function SplashScreen({ navigation }: Props): React.JSX.Element {
  const { theme } = useTheme();
  const initStarted = useRef(false);
  const announcementsStarted = useRef(false);

  const initStatus = useAppStore(state => state.initStatus);
  const onboardingComplete = useAppStore(state => state.onboardingComplete);
  const startupAnnounced = useAppStore(state => state.startupAnnounced);
  const setInitStatus = useAppStore(state => state.setInitStatus);
  const setOnboardingComplete = useAppStore(state => state.setOnboardingComplete);
  const markStartupAnnounced = useAppStore(state => state.markStartupAnnounced);

  const hydrateSettings = useSettingsStore(state => state.hydrate);
  const hydrateActivity = useActivityStore(state => state.hydrate);

  useEffect(() => {
    if (initStarted.current) {
      return;
    }
    initStarted.current = true;

    const runInit = async () => {
      setInitStatus('initializing');
      try {
        await TextToSpeechService.init();
        await Promise.all([hydrateSettings(), hydrateActivity()]);

        // Startup TTS is session-scoped (appStore) so each cold launch greets once
        // without repeating on navigation re-renders. Onboarding stays persisted.
        const onboardingStored = await StorageService.get<boolean>(
          STORAGE_KEYS.onboardingComplete,
        );

        if (onboardingStored === true) {
          setOnboardingComplete(true);
        }

        setInitStatus('ready');
      } catch {
        setInitStatus('error', 'Startup failed. You can still use the app visually.');
      }
    };

    void runInit();
  }, [
    hydrateActivity,
    hydrateSettings,
    markStartupAnnounced,
    setInitStatus,
    setOnboardingComplete,
  ]);

  useEffect(() => {
    if (initStatus !== 'ready') {
      return;
    }

    const target = onboardingComplete ? 'Main' : 'Onboarding';
    navigation.replace(target);
  }, [initStatus, navigation, onboardingComplete]);

  useEffect(() => {
    if (initStatus !== 'ready' || startupAnnounced || announcementsStarted.current) {
      return;
    }
    announcementsStarted.current = true;

    const speakStartup = async () => {
      // Mark immediately so remounts/re-renders cannot queue duplicate greets.
      markStartupAnnounced();

      const voiceEnabled = useSettingsStore.getState().voiceEnabled;
      if (!voiceEnabled) {
        return;
      }

      // First-time onboarding speaks its own welcome — avoid overlapping TTS.
      if (!useAppStore.getState().onboardingComplete) {
        return;
      }

      try {
        await new Promise<void>((resolve, reject) => {
          void TextToSpeechService.speak(
            `Welcome to ${APP_NAME}. Your vision assistant is starting.`,
            'high',
            {
              onDone: () => resolve(),
              onError: err => reject(err),
            },
          );
        });

        await new Promise<void>((resolve, reject) => {
          void TextToSpeechService.speak(
            `${APP_NAME} is ready. You can start camera assistance, ask a question, or explore the available features.`,
            'high',
            {
              onDone: () => resolve(),
              onError: err => reject(err),
            },
          );
        });
      } catch {
        // Visual app remains usable if TTS fails.
      }
    };

    void speakStartup();
  }, [initStatus, markStartupAnnounced, startupAnnounced]);

  return (
    <Screen accessibilityLabel="Splash, loading Drishti">
      <View style={styles.center}>
        <View
          style={[styles.logoBlock, { backgroundColor: theme.colors.navy }]}
          accessibilityRole="header">
          <AppText variant="title" style={{ color: theme.colors.white, fontSize: 36, lineHeight: 44 }}>
            {APP_NAME}
          </AppText>
          <AppText variant="body" style={{ color: theme.colors.primaryMuted, marginTop: 8 }}>
            {TAGLINE}
          </AppText>
        </View>
        <LoadingIndicator
          label={initStatus === 'error' ? 'Starting with limited features…' : 'Starting Drishti…'}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoBlock: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 32,
  },
});