import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../../components/typography/AppText';
import { AssistantStatusBadge } from '../../../components/status/AssistantStatusBadge';
import { useVoiceStore } from '../../../core/state/voiceStore';
import { useTheme } from '../../../theme/ThemeProvider';

export function AssistantStatusCard(): React.JSX.Element {
  const { theme } = useTheme();
  const voiceState = useVoiceStore(state => state.state);
  const announcementsEnabled = useVoiceStore(state => state.announcementsEnabled);
  const announcementsPaused = useVoiceStore(state => state.announcementsPaused);
  const lastError = useVoiceStore(state => state.lastError);

  const announcementLabel = !announcementsEnabled
    ? 'Announcements off'
    : announcementsPaused
      ? 'Announcements paused'
      : 'Announcements on';

  return (
    <View
      style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
      accessibilityRole="summary"
      accessibilityLabel={`Assistant status. Voice state ${voiceState}. ${announcementLabel}.`}>
      <AppText variant="label">Assistant status</AppText>
      <View style={styles.row}>
        <AssistantStatusBadge status={voiceState} />
        <AppText variant="caption" color="secondary">
          {announcementLabel}
        </AppText>
      </View>
      {lastError ? (
        <AppText variant="caption" color="danger">
          {lastError}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
});