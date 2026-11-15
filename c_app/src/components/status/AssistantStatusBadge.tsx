import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../typography/AppText';
import { VoiceAssistantState } from '../../core/types/voice.types';
import { useTheme } from '../../theme/ThemeProvider';

interface AssistantStatusBadgeProps {
  status: VoiceAssistantState;
}

const STATUS_META: Record<
  VoiceAssistantState,
  { label: string; icon: string; tone: 'neutral' | 'active' | 'warn' | 'danger' }
> = {
  IDLE: { label: 'Idle', icon: '○', tone: 'neutral' },
  LISTENING: { label: 'Listening', icon: '◎', tone: 'active' },
  PROCESSING: { label: 'Processing', icon: '◌', tone: 'active' },
  SPEAKING: { label: 'Speaking', icon: '▸', tone: 'active' },
  PAUSED: { label: 'Paused', icon: '❚❚', tone: 'warn' },
  ERROR: { label: 'Error', icon: '⚠', tone: 'danger' },
};

export function AssistantStatusBadge({ status }: AssistantStatusBadgeProps): React.JSX.Element {
  const { theme } = useTheme();
  const meta = STATUS_META[status];

  const backgroundColor = useMemo(() => {
    switch (meta.tone) {
      case 'active':
        return theme.colors.primaryMuted;
      case 'warn':
        return theme.colors.warning;
      case 'danger':
        return theme.colors.danger;
      default:
        return theme.colors.inputBackground;
    }
  }, [meta.tone, theme]);

  const textColor =
    meta.tone === 'neutral' ? theme.colors.text : theme.colors.navy;

  return (
    <View
      style={[styles.badge, { backgroundColor, borderColor: theme.colors.border }]}
      accessibilityRole="text"
      accessibilityLabel={`Assistant status: ${meta.label}`}>
      <AppText variant="label" style={[styles.icon, { color: textColor }]}>
        {meta.icon}
      </AppText>
      <AppText variant="label" style={{ color: textColor }}>
        {meta.label.toUpperCase()}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    fontSize: 14,
  },
});