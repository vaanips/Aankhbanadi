import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { AppText } from '../typography/AppText';
import { HapticService } from '../../core/services/HapticService';
import { useSettingsStore } from '../../core/state/settingsStore';
import { useTheme } from '../../theme/ThemeProvider';

interface SecondaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: ViewStyle;
}

export function SecondaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: SecondaryButtonProps): React.JSX.Element {
  const { theme } = useTheme();
  const hapticEnabled = useSettingsStore(state => state.hapticEnabled);

  const handlePress = () => {
    if (disabled || loading) {
      return;
    }
    if (hapticEnabled) {
      HapticService.light();
    }
    onPress();
  };

  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.surface,
          minHeight: Math.max(48, theme.minTouchTarget),
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}>
      {loading ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : (
        <AppText variant="label" style={{ color: theme.colors.primary, textAlign: 'center' }}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});