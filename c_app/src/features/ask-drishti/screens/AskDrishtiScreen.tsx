import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import {
  CompositeNavigationProp,
  useNavigation,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Screen } from '../../../components/layout/Screen';
import { Header } from '../../../components/layout/Header';
import { AppText } from '../../../components/typography/AppText';
import { SecondaryButton } from '../../../components/buttons/SecondaryButton';
import { ListeningPulse } from '../../../components/feedback/ListeningPulse';
import { SpeakingBars } from '../../../components/feedback/SpeakingBars';
import { TextToSpeechService } from '../../../core/services/TextToSpeechService';
import { useVoiceStore } from '../../../core/state/voiceStore';
import { useActivityStore } from '../../../core/state/activityStore';
import { useSettingsStore } from '../../../core/state/settingsStore';
import { MainTabParamList, RootStackParamList } from '../../../app/navigation/types';
import { useAssistantBootstrap } from '../../../hooks/useAssistantBootstrap';
import { useVoicePushToTalk } from '../../../hooks/useVoicePushToTalk';
import { useTheme } from '../../../theme/ThemeProvider';
import { timeAgo } from '../../../core/utils/formatters';

type AskNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Ask'>,
  NativeStackNavigationProp<RootStackParamList>
>;

function MicButton({
  active,
  onPressIn,
  onPressOut,
  onPress,
  pushToTalk,
}: {
  active: boolean;
  onPressIn?: () => void;
  onPressOut?: () => void;
  onPress: () => void;
  pushToTalk: boolean;
}): React.JSX.Element {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  React.useEffect(() => {
    if (active) {
      scale.value = withRepeat(withTiming(1.06, { duration: 500 }), -1, true);
    } else {
      scale.value = withTiming(1, { duration: 200 });
    }
  }, [active, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const size = Math.max(88, theme.minTouchTarget * 1.6);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={active ? 'Stop listening' : 'Push to talk microphone'}
      accessibilityHint={pushToTalk ? 'Press and hold to ask a question' : 'Tap to start or stop listening'}>
      <Animated.View
        style={[
          styles.micButton,
          animStyle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: active ? theme.colors.primary : theme.colors.card,
            borderColor: theme.colors.primary,
          },
        ]}>
        <AppText variant="title" style={{ color: active ? theme.colors.white : theme.colors.primary }}>
          🎤
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

export function AskDrishtiScreen(): React.JSX.Element {
  const navigation = useNavigation<AskNavProp>();
  const { theme } = useTheme();
  const voiceState = useVoiceStore(state => state.state);
  const recognizedText = useVoiceStore(state => state.recognizedText);
  const responseText = useVoiceStore(state => state.responseText);
  const pushToTalk = useSettingsStore(state => state.pushToTalk);
  const voiceEnabled = useSettingsStore(state => state.voiceEnabled);
  const entries = useActivityStore(state => state.entries);
  const { onPressIn, onPressOut, toggleListening, cancelListening, isListening } = useVoicePushToTalk();

  const navCallbacks = useMemo(
    () => ({
      onNavigateHome: () => navigation.navigate('Home'),
      onNavigateSettings: () => navigation.navigate('Settings'),
      onNavigateBack: () => navigation.goBack(),
      onStartCamera: () => navigation.navigate('Camera'),
      onStopCamera: () => navigation.navigate('Camera'),
    }),
    [navigation],
  );

  useAssistantBootstrap(navCallbacks);

  const conversation = useMemo(
    () =>
      entries.filter(
        e => e.kind === 'voice_command' || e.kind === 'assistant_response',
      ).slice(0, 30),
    [entries],
  );

  const [historyOpen, setHistoryOpen] = useState(true);

  const repeatResponse = useCallback(async () => {
    const text = responseText.trim();
    if (!text || !voiceEnabled) {
      return;
    }
    await TextToSpeechService.speak(text, 'high');
  }, [responseText, voiceEnabled]);

  return (
    <Screen accessibilityLabel="Ask Drishti">
      <Header title="Ask Drishti" subtitle="Voice questions" />
      <View style={styles.content}>
        <View style={styles.visuals}>
          <ListeningPulse active={voiceState === 'LISTENING'} />
          <SpeakingBars active={voiceState === 'SPEAKING'} />
        </View>

        <MicButton
          active={isListening}
          pushToTalk={pushToTalk}
          onPress={pushToTalk ? () => {} : () => {
            void toggleListening();
          }}
          onPressIn={pushToTalk ? onPressIn : undefined}
          onPressOut={pushToTalk ? onPressOut : undefined}
        />

        <AppText variant="caption" color="secondary" style={styles.stateLabel}>
          {voiceState === 'LISTENING'
            ? 'Listening…'
            : voiceState === 'PROCESSING'
              ? 'Processing…'
              : voiceState === 'SPEAKING'
                ? 'Speaking…'
                : 'Ready'}
        </AppText>

        <View style={[styles.textBlock, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <AppText variant="label">Your question</AppText>
          <AppText variant="body" color={recognizedText ? 'inherit' : 'secondary'}>
            {recognizedText || 'Recognized speech will appear here.'}
          </AppText>
        </View>

        <View style={[styles.textBlock, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <AppText variant="label">Assistant response</AppText>
          <AppText variant="body" color={responseText ? 'inherit' : 'secondary'}>
            {responseText || 'Responses appear here and are spoken aloud.'}
          </AppText>
        </View>

        <View style={styles.rowButtons}>
          <SecondaryButton
            label="Repeat response"
            onPress={() => {
              void repeatResponse();
            }}
            disabled={!responseText}
          />
          <SecondaryButton
            label="Cancel listening"
            onPress={cancelListening}
            disabled={voiceState !== 'LISTENING'}
          />
        </View>

        <Pressable
          onPress={() => setHistoryOpen(v => !v)}
          style={styles.historyToggle}
          accessibilityRole="button"
          accessibilityLabel={historyOpen ? 'Hide conversation history' : 'Show conversation history'}>
          <AppText variant="label">Conversation history</AppText>
        </Pressable>

        {historyOpen ? (
          <FlatList
            data={conversation}
            keyExtractor={item => item.id}
            style={styles.historyList}
            ListEmptyComponent={
              <AppText variant="body" color="secondary">
                No messages yet. Hold the mic button and ask a question.
              </AppText>
            }
            renderItem={({ item }) => (
              <View style={[styles.historyRow, { borderColor: theme.colors.border }]}>
                <AppText variant="caption" color="secondary">
                  {timeAgo(item.timestamp)} · {item.kind === 'voice_command' ? 'You' : 'Drishti'}
                </AppText>
                <AppText variant="body">{item.detail ?? item.title}</AppText>
              </View>
            )}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingTop: 8,
    alignItems: 'stretch',
    gap: 12,
  },
  visuals: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginVertical: 8,
  },
  stateLabel: {
    textAlign: 'center',
  },
  textBlock: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 6,
  },
  rowButtons: {
    gap: 10,
  },
  historyToggle: {
    minHeight: 48,
    justifyContent: 'center',
  },
  historyList: {
    maxHeight: 220,
  },
  historyRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
});