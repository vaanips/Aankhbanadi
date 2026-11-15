import React, { useCallback } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { Screen } from '../../../components/layout/Screen';
import { Header } from '../../../components/layout/Header';
import { AppText } from '../../../components/typography/AppText';
import { SecondaryButton } from '../../../components/buttons/SecondaryButton';
import { announcementManager } from '../../../domain/announcements/AnnouncementManager';
import { useActivityStore } from '../../../core/state/activityStore';
import { ActivityEntry, ActivityKind } from '../../../core/types/activity.types';
import { useTheme } from '../../../theme/ThemeProvider';
import { timeAgo } from '../../../core/utils/formatters';

function kindLabel(kind: ActivityKind): string {
  switch (kind) {
    case 'voice_command':
      return 'Voice';
    case 'assistant_response':
      return 'Response';
    case 'camera':
      return 'Camera';
    case 'announcement':
      return 'Announcement';
    case 'navigation':
      return 'Navigation';
    case 'error':
      return 'Error';
    default:
      return 'System';
  }
}

function statusForEntry(entry: ActivityEntry): string {
  if (entry.kind === 'error') {
    return 'Failed';
  }
  return 'Completed';
}

export function ActivityScreen(): React.JSX.Element {
  const entries = useActivityStore(state => state.entries);
  const clearHistory = useActivityStore(state => state.clearHistory);
  const { theme } = useTheme();

  const confirmClear = useCallback(() => {
    Alert.alert(
      'Clear activity history?',
      'This removes all saved events from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            void clearHistory();
            announcementManager.announce('Activity history cleared.', 'normal');
          },
        },
      ],
    );
  }, [clearHistory]);

  return (
    <Screen accessibilityLabel="Activity">
      <Header title="Activity" subtitle="Recent events" />
      <View style={styles.toolbar}>
        <SecondaryButton
          label="Clear history"
          onPress={confirmClear}
          accessibilityHint="Asks for confirmation before clearing all activity"
          disabled={entries.length === 0}
        />
      </View>
      <View style={styles.listWrap}>
        <FlatList
          data={entries}
          keyExtractor={item => item.id}
          contentContainerStyle={entries.length === 0 ? styles.emptyContainer : undefined}
          ListEmptyComponent={
            <AppText variant="body" color="secondary" style={styles.empty}>
              No activity yet. Voice commands, assistant replies, and camera events will appear here.
            </AppText>
          }
          renderItem={({ item }) => (
            <View
              style={[styles.row, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
              accessibilityLabel={`${kindLabel(item.kind)}, ${statusForEntry(item)}, ${timeAgo(item.timestamp)}. ${item.detail ?? item.title}`}>
              <View style={styles.rowHeader}>
                <AppText variant="label">{item.title}</AppText>
                <AppText variant="caption" color="secondary">
                  {timeAgo(item.timestamp)}
                </AppText>
              </View>
              <View style={styles.meta}>
                <AppText variant="caption" color="primary">
                  {kindLabel(item.kind)}
                </AppText>
                <AppText variant="caption" color="success">
                  {statusForEntry(item)}
                </AppText>
              </View>
              {item.detail ? (
                <AppText variant="body" color="secondary">
                  {item.detail}
                </AppText>
              ) : null}
            </View>
          )}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  listWrap: {
    flex: 1,
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  meta: {
    flexDirection: 'row',
    gap: 12,
  },
  empty: {
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 40,
  },
});