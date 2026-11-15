import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  CompositeNavigationProp,
  useNavigation,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../../../components/layout/Screen';
import { AppText } from '../../../components/typography/AppText';
import { ActionCard } from '../../../components/cards/ActionCard';
import { DemoModeBanner } from '../../../components/status/DemoModeBanner';
import { announcementManager } from '../../../domain/announcements/AnnouncementManager';
import { useAppStore } from '../../../core/state/appStore';
import { MainTabParamList } from '../../../app/navigation/types';
import { RootStackParamList } from '../../../app/navigation/types';
import { APP_NAME } from '../../../core/utils/constants';
import { AssistantStatusCard } from '../components/AssistantStatusCard';
import { QuickControls } from '../components/QuickControls';
import { useAssistantBootstrap } from '../../../hooks/useAssistantBootstrap';
import { useVoicePushToTalk } from '../../../hooks/useVoicePushToTalk';

type HomeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 17) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

export function HomeScreen(): React.JSX.Element {
  const navigation = useNavigation<HomeNavProp>();
  const demoMode = useAppStore(state => state.demoMode);
  const { toggleListening, isListening } = useVoicePushToTalk();

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

  const announceAndNavigate = useCallback(
    (message: string, tab: keyof MainTabParamList) => {
      announcementManager.announce(message, 'normal');
      navigation.navigate(tab);
    },
    [navigation],
  );

  const openHelp = useCallback(() => {
    announcementManager.announce('Opening help.', 'normal');
    navigation.navigate('Help');
  }, [navigation]);

  return (
    <Screen scroll accessibilityLabel="Home">
      {demoMode ? <DemoModeBanner /> : null}
      <View style={styles.header} accessibilityRole="header">
        <AppText variant="title">{APP_NAME}</AppText>
        <AppText variant="body" color="secondary">
          {getGreeting()}
        </AppText>
      </View>

      <View style={styles.content}>
        <AssistantStatusCard />

        <ActionCard
          title="Start Camera Assistance"
          description="Open the camera tab and begin demo scene assistance."
          onPress={() => announceAndNavigate('Opening camera assistance.', 'Camera')}
        />
        <ActionCard
          title="Ask Drishti"
          description="Ask questions about your surroundings with your voice."
          onPress={() => announceAndNavigate('Opening Ask Drishti.', 'Ask')}
        />
        <ActionCard
          title="Voice Assistant"
          description={
            isListening ? 'Listening… release or tap again to finish.' : 'Tap for push-to-talk voice commands.'
          }
          onPress={() => {
            void toggleListening();
          }}
          accessibilityHint="Starts or stops voice listening"
        />
        <ActionCard
          title="Recent Activity"
          description="Review voice commands, responses, and camera events."
          onPress={() => announceAndNavigate('Opening recent activity.', 'Activity')}
        />
        <ActionCard
          title="Accessibility Settings"
          description="Adjust voice, text size, contrast, and interaction options."
          onPress={() => announceAndNavigate('Opening accessibility settings.', 'Settings')}
        />

        <QuickControls onHelp={openHelp} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 4,
  },
  content: {
    paddingTop: 8,
    gap: 4,
  },
});