import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  CompositeNavigationProp,
  useNavigation,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../../../components/layout/Screen';
import { Header } from '../../../components/layout/Header';
import { AppText } from '../../../components/typography/AppText';
import { PrimaryButton } from '../../../components/buttons/PrimaryButton';
import { SecondaryButton } from '../../../components/buttons/SecondaryButton';
import { DemoModeBanner } from '../../../components/status/DemoModeBanner';
import { AssistantStatusBadge } from '../../../components/status/AssistantStatusBadge';
import { IconButton } from '../../../components/buttons/IconButton';
import { useCameraStore } from '../../../core/state/cameraStore';
import { useVoiceStore } from '../../../core/state/voiceStore';
import { MainTabParamList, RootStackParamList } from '../../../app/navigation/types';
import { CameraPreviewPanel } from '../components/CameraPreviewPanel';
import { DetectionsPanel } from '../components/DetectionsPanel';
import { useCameraAssistance } from '../hooks/useCameraAssistance';
import { useAssistantBootstrap } from '../../../hooks/useAssistantBootstrap';
import { useVoicePushToTalk } from '../../../hooks/useVoicePushToTalk';
import { useSettingsStore } from '../../../core/state/settingsStore';

type CameraNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Camera'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function CameraAssistanceScreen(): React.JSX.Element {
  const navigation = useNavigation<CameraNavProp>();
  const voiceState = useVoiceStore(state => state.state);
  const pushToTalk = useSettingsStore(state => state.pushToTalk);
  const lastError = useCameraStore(state => state.lastError);
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
  const { onPressIn, onPressOut, toggleListening, isListening } = useVoicePushToTalk();

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

  const denied = permission === 'denied' || permission === 'blocked';

  return (
    <Screen scroll accessibilityLabel="Camera assistance">
      <DemoModeBanner />
      <Header title="Camera" subtitle="Scene assistance (demo)" />
      <View style={styles.content}>
        <View style={styles.statusRow}>
          <AssistantStatusBadge status={voiceState} />
          <AppText variant="caption" color="secondary">
            Camera {isActive ? 'active' : 'idle'}
          </AppText>
        </View>

        <CameraPreviewPanel canShowLivePreview={canShowLivePreview && !denied} />

        {denied ? (
          <View style={styles.permissionBlock}>
            <AppText variant="body" accessibilityRole="alert">
              Camera permission is {permission}. Allow camera access in settings for a live preview, or continue with
              demo detections only.
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
            label={isActive ? 'Assistance running' : 'Start assistance'}
            onPress={handleStart}
            disabled={isActive}
            accessibilityHint="Starts mock detection stream and optional live preview"
          />
          <SecondaryButton
            label="Stop assistance"
            onPress={handleStop}
            disabled={!isActive}
            accessibilityHint="Stops mock detections"
          />
        </View>

        <View style={styles.micRow}>
          <IconButton
            icon="🎤"
            accessibilityLabel="Microphone push to talk"
            accessibilityHint={pushToTalk ? 'Press and hold to speak' : 'Tap to toggle listening'}
            onPress={pushToTalk ? () => {} : () => {
              void toggleListening();
            }}
            onPressIn={pushToTalk ? onPressIn : undefined}
            onPressOut={pushToTalk ? onPressOut : undefined}
          />
          <AppText variant="caption" color="secondary">
            {isListening ? 'Listening…' : 'Voice mic control'}
          </AppText>
        </View>

        <DetectionsPanel detections={detections} assistanceActive={isActive} />

        {lastError ? (
          <AppText variant="caption" color="danger">
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