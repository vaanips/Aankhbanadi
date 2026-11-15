import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { AppText } from '../typography/AppText';
import { HapticService } from '../../core/services/HapticService';
import { useSettingsStore } from '../../core/state/settingsStore';
import { useTheme } from '../../theme/ThemeProvider';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: ViewStyle;
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: PrimaryButtonProps): React.JSX.Element {
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
          backgroundColor: theme.colors.primary,
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
        <ActivityIndicator color={theme.colors.white} accessibilityLabel="Loading" />
      ) : (
        <AppText variant="label" style={{ color: theme.colors.white, textAlign: 'center' }}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});