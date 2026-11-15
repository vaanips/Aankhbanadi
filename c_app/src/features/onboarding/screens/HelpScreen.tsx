import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../../../components/layout/Screen';
import { Header } from '../../../components/layout/Header';
import { AppText } from '../../../components/typography/AppText';
import { useTheme } from '../../../theme/ThemeProvider';

const VOICE_COMMANDS = [
  { phrase: 'Start camera / Stop camera', detail: 'Turn scene assistance on or off.' },
  { phrase: 'What can you see?', detail: 'Hear a summary of the current scene.' },
  { phrase: 'What is in front? / Anything on the left or right?', detail: 'Directional scene queries.' },
  { phrase: 'Is there a person nearby?', detail: 'Yes or no questions about objects.' },
  { phrase: 'Anything within five steps?', detail: 'Proximity checks within a step range.' },
  { phrase: 'Start / stop / pause / resume announcements', detail: 'Control periodic scene announcements.' },
  { phrase: 'Open settings / Go home', detail: 'Navigate the app by voice.' },
  { phrase: 'Help / What can you do?', detail: 'Hear this command list spoken aloud.' },
] as const;

export function HelpScreen(): React.JSX.Element {
  const { theme } = useTheme();

  return (
    <Screen scroll accessibilityLabel="Help, voice commands">
      <Header title="Help" subtitle="Supported voice commands" showBack />
      <View style={styles.content}>
        <AppText variant="body" color="secondary">
          Say these phrases when voice is enabled. Wording can vary slightly; Drishti will do its best to understand.
        </AppText>
        {VOICE_COMMANDS.map(item => (
          <View
            key={item.phrase}
            style={[styles.row, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <AppText variant="label">{item.phrase}</AppText>
            <AppText variant="caption" color="secondary" style={styles.detail}>
              {item.detail}
            </AppText>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 16,
    gap: 12,
  },
  row: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  detail: {
    marginTop: 6,
  },
});