import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { AppText } from '../typography/AppText';
import { HapticService } from '../../core/services/HapticService';
import { useSettingsStore } from '../../core/state/settingsStore';
import { useTheme } from '../../theme/ThemeProvider';

interface ActionCardProps {
  title: string;
  description: string;
  onPress: () => void;
  accessibilityHint?: string;
}

export function ActionCard({
  title,
  description,
  onPress,
  accessibilityHint,
}: ActionCardProps): React.JSX.Element {
  const { theme } = useTheme();
  const hapticEnabled = useSettingsStore(state => state.hapticEnabled);

  const handlePress = () => {
    if (hapticEnabled) {
      HapticService.medium();
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          minHeight: Math.max(72, theme.minTouchTarget),
          opacity: pressed ? 0.9 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint ?? description}>
      <AppText variant="label">{title}</AppText>
      <AppText variant="body" color="secondary" style={styles.description}>
        {description}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 12,
  },
  description: {
    marginTop: 6,
  },
});