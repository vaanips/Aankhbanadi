import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../../components/typography/AppText';
import { DetectionGroupingService } from '../../../domain/detection/DetectionGroupingService';
import { Detection } from '../../../core/types/detection.types';
import { formatStepsText } from '../../../core/utils/formatters';
import { useTheme } from '../../../theme/ThemeProvider';

interface DetectionsPanelProps {
  detections: Detection[];
  assistanceActive: boolean;
}

export function DetectionsPanel({
  detections,
  assistanceActive,
}: DetectionsPanelProps): React.JSX.Element {
  const { theme } = useTheme();

  const summary = useMemo(
    () => DetectionGroupingService.summarize(detections),
    [detections],
  );
  const directionGroups = useMemo(
    () => DetectionGroupingService.groupByDirection(detections),
    [detections],
  );
  const nearest = useMemo(() => {
    if (detections.length === 0) {
      return null;
    }
    return [...detections].sort(
      (a, b) => (a.estimatedSteps ?? 99) - (b.estimatedSteps ?? 99),
    )[0];
  }, [detections]);

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`Recent live detections. ${summary}.`}
    >
      <AppText variant="label">Recent detections</AppText>
      {!assistanceActive ? (
        <AppText variant="body" color="secondary">
          Start assistance to begin live object detection.
        </AppText>
      ) : detections.length === 0 ? (
        <AppText variant="body" color="secondary">
          Waiting for detections…
        </AppText>
      ) : (
        <>
          <AppText variant="body">Summary: {summary}</AppText>
          <View style={styles.section}>
            <AppText variant="label">By direction</AppText>
            {directionGroups.map(group => (
              <AppText
                key={group.direction}
                variant="caption"
                color="secondary"
              >
                {DetectionGroupingService.displayName(group.direction)}:{' '}
                {group.count} item
                {group.count === 1 ? '' : 's'}
              </AppText>
            ))}
          </View>
          {nearest ? (
            <View style={styles.section}>
              <AppText variant="label">Nearest</AppText>
              <AppText variant="caption" color="secondary">
                {DetectionGroupingService.displayName(nearest.className)} —{' '}
                {formatStepsText(nearest.estimatedSteps)}
                {nearest.direction ? `, ${nearest.direction}` : ''}
              </AppText>
            </View>
          ) : null}
          <AppText variant="caption" color="secondary" style={styles.note}>
            Distances are estimates. Check your surroundings carefully and do
            not rely on this app alone for safety.
          </AppText>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 8,
    marginBottom: 16,
  },
  section: {
    gap: 4,
    marginTop: 4,
  },
  note: {
    marginTop: 8,
  },
});
