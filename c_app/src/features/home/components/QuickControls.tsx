import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton } from '../../../components/buttons/IconButton';
import { AppText } from '../../../components/typography/AppText';
import { announcementManager } from '../../../domain/announcements/AnnouncementManager';
import { TextToSpeechService } from '../../../core/services/TextToSpeechService';
import { useSettingsStore } from '../../../core/state/settingsStore';
import { useVoiceStore } from '../../../core/state/voiceStore';
import { useVoicePushToTalk } from '../../../hooks/useVoicePushToTalk';

interface QuickControlsProps {
  onHelp: () => void;
}

export function QuickControls({ onHelp }: QuickControlsProps): React.JSX.Element {
  const { onPressIn, onPressOut, isListening, toggleListening } = useVoicePushToTalk();
  const pushToTalk = useSettingsStore(state => state.pushToTalk);
  const announcementsPaused = useVoiceStore(state => state.announcementsPaused);
  const announcementsEnabled = useVoiceStore(state => state.announcementsEnabled);
  const responseText = useVoiceStore(state => state.responseText);
  const voiceEnabled = useSettingsStore(state => state.voiceEnabled);

  const handleMic = () => {
    if (pushToTalk) {
      return;
    }
    void toggleListening();
  };

  const toggleAnnouncements = () => {
    if (!announcementsEnabled) {
      announcementManager.enable();
      announcementManager.announce('Announcements enabled.', 'normal');
      return;
    }
    if (announcementsPaused) {
      announcementManager.resume();
      announcementManager.announce('Announcements resumed.', 'normal');
    } else {
      announcementManager.pause();
      announcementManager.announce('Announcements paused.', 'normal');
    }
  };

  const repeatLast = async () => {
    const text = responseText.trim();
    if (!text) {
      announcementManager.announce('No recent response to repeat.', 'normal');
      return;
    }
    if (voiceEnabled) {
      await TextToSpeechService.speak(text, 'high');
    }
  };

  return (
    <View accessibilityRole="toolbar" accessibilityLabel="Quick voice controls">
      <AppText variant="label" style={styles.heading}>
        Quick controls
      </AppText>
      <View style={styles.row}>
        <IconButton
          icon="🎤"
          accessibilityLabel={isListening ? 'Stop listening' : 'Push to talk microphone'}
          accessibilityHint={
            pushToTalk ? 'Press and hold to speak' : 'Double tap to start or stop listening'
          }
          onPress={pushToTalk ? () => {} : handleMic}
          onPressIn={pushToTalk ? onPressIn : undefined}
          onPressOut={pushToTalk ? onPressOut : undefined}
          style={isListening ? styles.micActive : undefined}
        />
        <IconButton
          icon={announcementsEnabled && !announcementsPaused ? '🔊' : '🔇'}
          accessibilityLabel="Toggle announcements"
          accessibilityHint="Starts, pauses, or resumes scene announcements"
          onPress={toggleAnnouncements}
        />
        <IconButton
          icon="↻"
          accessibilityLabel="Repeat last response"
          onPress={() => {
            void repeatLast();
          }}
        />
        <IconButton icon="?" accessibilityLabel="Open help" onPress={onHelp} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'flex-start',
  },
  micActive: {
    borderWidth: 2,
  },
});