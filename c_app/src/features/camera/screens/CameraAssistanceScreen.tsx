import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  CompositeNavigationProp,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../../../components/layout/Screen';
import { Header } from '../../../components/layout/Header';
import { AppText } from '../../../components/typography/AppText';
import { PrimaryButton } from '../../../components/buttons/PrimaryButton';
import { SecondaryButton } from '../../../components/buttons/SecondaryButton';
import { AssistantStatusBadge } from '../../../components/status/AssistantStatusBadge';
import { IconButton } from '../../../components/buttons/IconButton';
import { useCameraStore } from '../../../core/state/cameraStore';
import { useVoiceStore } from '../../../core/state/voiceStore';
import {
  MainTabParamList,
  RootStackParamList,
} from '../../../app/navigation/types';
import { CameraPreviewPanel } from '../components/CameraPreviewPanel';
import { DetectionsPanel } from '../components/DetectionsPanel';
import { useCameraAssistance } from '../hooks/useCameraAssistance';
import { useAssistantBootstrap } from '../../../hooks/useAssistantBootstrap';
import { useVoicePushToTalk } from '../../../hooks/useVoicePushToTalk';
import { useSettingsStore } from '../../../core/state/settingsStore';
import { getRemoteProvider } from '../../../domain/detection/detectionRuntime';

type CameraNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Camera'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function CameraAssistanceScreen(): React.JSX.Element {
  const navigation = useNavigation<CameraNavProp>();
  const voiceState = useVoiceStore(state => state.state);
  const pushToTalk = useSettingsStore(state => state.pushToTalk);
  const lastError = useCameraStore(state => state.lastError);
  const setLastError = useCameraStore(state => state.setLastError);
  const {
    detections,
    isActive,
    permission,
    canShowLivePreview,
    startAssistance,
    stopAssistance,
    openAppSettings,
    refreshPermission,
  } = useCameraAssistance();
  const { onPressIn, onPressOut, toggleListening, isListening } =
    useVoicePushToTalk();
  const handleFrameCaptured = useCallback(
    async (path: string) => {
      const provider = getRemoteProvider();
      await provider.processFrameFile(path);
      setLastError(
        provider.getLastError()
          ? 'Live detection is unavailable. Reconnect to the laptop to resume object detection.'
          : null,
      );
    },
    [setLastError],
  );

  const navCallbacks = useMemo(
    () => ({
      onNavigateHome: () => navigation.navigate('Home'),
      onNavigateSettings: () => navigation.navigate('Settings'),
      onStartCamera: () => {
        void startAssistance();
      },
      onStopCamera: () => {
        void stopAssistance();
      },
    }),
    [navigation, startAssistance, stopAssistance],
  );

  useAssistantBootstrap(navCallbacks);

  const handleStart = useCallback(() => {
    void startAssistance();
  }, [startAssistance]);

  const handleStop = useCallback(() => {
    void stopAssistance();
  }, [stopAssistance]);

  useFocusEffect(
    useCallback(
      () => () => {
        void stopAssistance();
      },
      [stopAssistance],
    ),
  );

  const denied = permission === 'denied' || permission === 'blocked';
  const starting = useCameraStore(
    state => state.cameraState === 'INITIALIZING',
  );

  return (
    <Screen scroll accessibilityLabel="Camera assistance">
      <Header title="Camera" subtitle="Live scene assistance" />
      <View style={styles.content}>
        <View style={styles.statusRow}>
          <AssistantStatusBadge status={voiceState} />
          <AppText variant="caption" color="secondary">
            Camera {isActive ? 'active' : 'idle'}
          </AppText>
        </View>

        <CameraPreviewPanel
          canShowLivePreview={canShowLivePreview && !denied}
          active={isActive}
          onFrameCaptured={handleFrameCaptured}
        />

        {denied ? (
          <View style={styles.permissionBlock}>
            <AppText variant="body" accessibilityRole="alert">
              Camera permission is {permission}. Allow camera access in settings
              to use live object detection.
            </AppText>
            <SecondaryButton
              label="Open device settings"
              onPress={() => {
                void openAppSettings();
              }}
              accessibilityHint="Opens system settings for Drishti permissions"
            />
            <SecondaryButton
              label="Refresh permission"
              onPress={() => {
                void refreshPermission();
              }}
            />
          </View>
        ) : null}

        <View style={styles.actions}>
          <PrimaryButton
            label={
              isActive
                ? 'Assistance running'
                : starting
                ? 'Starting…'
                : 'Start live assistance'
            }
            onPress={handleStart}
            disabled={isActive || starting}
            accessibilityHint="Starts the camera and live object detection"
          />
          <SecondaryButton
            label="Stop assistance"
            onPress={handleStop}
            disabled={!isActive && !starting}
            accessibilityHint="Stops live object detection"
          />
        </View>

        <View style={styles.micRow}>
          <IconButton
            icon="🎤"
            accessibilityLabel="Microphone push to talk"
            accessibilityHint={
              pushToTalk ? 'Press and hold to speak' : 'Tap to toggle listening'
            }
            onPress={
              pushToTalk
                ? () => {}
                : () => {
                    void toggleListening();
                  }
            }
            onPressIn={pushToTalk ? onPressIn : undefined}
            onPressOut={pushToTalk ? onPressOut : undefined}
          />
          <AppText variant="caption" color="secondary">
            {isListening ? 'Listening…' : 'Voice mic control'}
          </AppText>
        </View>

        <DetectionsPanel detections={detections} assistanceActive={isActive} />

        {lastError ? (
          <AppText
            variant="caption"
            color="secondary"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {lastError}
          </AppText>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  permissionBlock: {
    gap: 12,
    marginBottom: 16,
  },
  actions: {
    gap: 12,
    marginBottom: 16,
  },
  micRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
});
